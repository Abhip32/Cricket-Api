const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

/**
 * Normalizes any match URL to the /full-scorecard endpoint.
 */
function normalizeScorecardUrl(rawUrl) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();

  if (!url.startsWith('http')) {
    url = `https://www.espncricinfo.com${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // Remove trailing slashes and hash/query params for clean normalization
  url = url.split('#')[0].split('?')[0].replace(/\/$/, '');

  // Map other tabs to /full-scorecard
  if (url.includes('/live-cricket-score')) {
    url = url.replace('/live-cricket-score', '/full-scorecard');
  } else if (url.includes('/match-preview')) {
    url = url.replace('/match-preview', '/full-scorecard');
  } else if (url.includes('/match-report')) {
    url = url.replace('/match-report', '/full-scorecard');
  } else if (url.includes('/ball-by-ball-commentary')) {
    url = url.replace('/ball-by-ball-commentary', '/full-scorecard');
  } else if (!url.endsWith('/full-scorecard')) {
    url = `${url}/full-scorecard`;
  }

  return url;
}

/**
 * Finds the latest live or recent match URL if none is provided.
 */
async function getLatestMatchUrl() {
  try {
    const html = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-score', { waitMs: 1000 });
    const $ = cheerio.load(html);
    const firstLink = $('a[href*="/full-scorecard"], a[href*="/live-cricket-score"]').first().attr('href');
    if (firstLink) {
      return normalizeScorecardUrl(firstLink);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

const scoreCardController = {
  getScorecard: async (req, res) => {
    let rawUrl = req.query.url ? String(req.query.url).trim() : '';

    let url = rawUrl ? normalizeScorecardUrl(rawUrl) : await getLatestMatchUrl();

    if (!url) {
      return res.status(400).json({
        error: 'No URL provided',
        message: 'Please provide a valid match scorecard URL in the ?url= query parameter.'
      });
    }

    const cacheKey = `scorecard_${url}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const html = await fetchPageHtml(url, { waitMs: 1500 });
      const $ = cheerio.load(html);

      const scorecardData = {
        tables: []
      };

      // 1. Scrape structured JSON-LD if available
      let sportsEvent = null;
      $('script[type="application/ld+json"]').each((_, s) => {
        try {
          const data = JSON.parse($(s).text());
          if (data['@type'] === 'SportsEvent') sportsEvent = data;
        } catch (e) {}
      });

      // 2. Scrape Summary / Match Info
      const teams = [];
      $('.ci-team-score').each((i, teamDiv) => {
        const teamName = $(teamDiv).find('p, a, span.ds-text-title-1').first().text().trim();
        // Dynamic flag extraction with fallback to dynamic registry
        const teamLogo = flagService.extractFlagFromElement($, teamDiv, teamName);

        // Extract score
        let score = $(teamDiv).find('strong').text().trim();
        const scoreContainer = $(teamDiv).find('.ds-text-right, div[class*="ds-text-compact"], div[class*="ds-text-title"]').last();
        if (!score && scoreContainer.length) {
          scoreContainer.find('span').each((_, sp) => {
            const t = $(sp).text().trim();
            if (/\d+\/\d+|\d+/.test(t) && !t.includes('ov') && !t.includes('T:')) {
              score = t;
            }
          });
        }

        // Extract overs / target
        let overs = $(teamDiv).find('span[class*="ds-mr-0"], span[class*="ds-text-compact-xs"], span[class*="ds-text-body"]').filter((_, sp) => {
          const t = $(sp).text().trim();
          return t.includes('ov') || t.includes('T:');
        }).first().text().trim();

        if (teamName || score) {
          teams.push({
            teamName,
            teamLogo,
            score,
            overs
          });
        }
      });

      let result = '';
      $('p[class*="ds-text-tight-s"]').each((_, p) => {
        const text = $(p).text().trim();
        if (text.includes('won by') || text.includes('tied') || text.includes('No result') || text.includes('target') || text.includes('Match scheduled') || text.includes('Innings break')) {
          result = text;
          return false;
        }
      });
      if (!result && sportsEvent) {
        result = sportsEvent.description || '';
      }

      let venue = sportsEvent?.location?.name || '';
      if (!venue) {
        venue = $('.ds-text-tight-xs.ds-truncate.ds-text-typo-mid3').first().text().trim();
      }

      scorecardData.summary = {
        matchTitle: sportsEvent ? sportsEvent.name : $('h1').first().text().trim(),
        status: sportsEvent ? sportsEvent.eventStatus : '',
        result,
        venue,
        teams
      };

      // 3. Scrape Innings Tables (Batting & Bowling)
      $('table').each((tableIdx, table) => {
        const $table = $(table);
        const headers = [];

        $table.find('thead th').each((i, th) => {
          if (!$(th).hasClass('ds-hidden')) {
            headers.push($(th).text().trim());
          }
        });

        const firstHeader = headers[0]?.toLowerCase() || '';
        const isBattingTable = firstHeader.includes('batting') || firstHeader.includes('batsmen') || $table.hasClass('ci-scorecard-table');
        const isBowlingTable = firstHeader.includes('bowling');

        if (!isBattingTable && !isBowlingTable) {
          return; // Skip non-scorecard tables
        }

        const tableType = isBattingTable ? 'Batting' : 'Bowling';

        // Find table title (Innings / Team)
        let tableTitle = '';
        const container = $table.closest('.ds-mb-4, div[class*="ds-bg-fill-content-prime"], .ds-rounded-lg');
        if (container.length) {
          const teamName = container.find('span.ds-text-title-1, span.ds-text-title-xs, h2').first().text().trim();
          const overs = container.find('span.ds-text-title-4, span.ds-text-compact-xs').first().text().trim();
          tableTitle = overs ? `${teamName} ${overs}`.trim() : teamName;
        }

        const rows = [];
        $table.find('tbody tr').each((i, row) => {
          const $row = $(row);

          // Skip hidden or nested detail rows
          if ($row.hasClass('ds-hidden') || $row.find('td[colspan]').length > 1) {
            return;
          }

          const tds = $row.find('td').filter((_, td) => !$(td).hasClass('ds-hidden'));
          if (tds.length === 0) return;

          const rowData = {};
          tds.each((j, td) => {
            const header = headers[j] || `col_${j}`;
            const cellText = $(td).text().trim();
            rowData[header] = cellText;
          });

          // Check if row has valid player data
          const firstCell = Object.values(rowData)[0] || '';
          if (firstCell && !firstCell.toLowerCase().includes('extras') && !firstCell.toLowerCase().includes('total')) {
            rows.push(rowData);
          }
        });

        if (rows.length > 0) {
          scorecardData.tables.push({
            title: tableTitle,
            type: tableType,
            headers: headers.filter(h => h.length > 0),
            rows: rows
          });
        }
      });

      if (scorecardData.tables.length === 0 && (!scorecardData.summary || scorecardData.summary.teams.length === 0)) {
        return res.status(404).json({
          error: 'No scorecard data found',
          message: 'No match scorecard data is currently available for this URL.',
          data: { tables: [], summary: null }
        });
      }

      const responsePayload = {
        message: 'Match scorecard retrieved successfully',
        tableCount: scorecardData.tables.length,
        data: scorecardData
      };

      // If match is finished, cache for 30 minutes; otherwise 45 seconds
      const isFinished = scorecardData.summary.status === 'RESULT' || scorecardData.summary.result?.includes('won by');
      const cacheTtl = isFinished ? 30 * 60 * 1000 : 45 * 1000;
      cacheService.set(cacheKey, responsePayload, cacheTtl);

      res.status(200).json(responsePayload);
    } catch (err) {
      console.error('getScorecard error:', err.message);
      res.status(500).json({
        error: 'Scraping failed',
        message: 'Failed to retrieve match scorecard. Please try again later.',
        details: err.message
      });
    }
  }
};

module.exports = scoreCardController;
