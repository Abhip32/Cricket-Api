const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

const scoreCardController = {
  getScoreCard: async (req, res) => {
    let url = req.query.url;

    // Default to the first live or recent match if no URL is provided
    if (!url) {
      try {
        const liveHtml = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-score', { waitMs: 1000 });
        const $live = cheerio.load(liveHtml);
        const firstMatchLink = $live('a[href*="/live-cricket-score"], a[href*="/full-scorecard"]').first().attr('href');
        if (firstMatchLink) {
          url = firstMatchLink.startsWith('http') ? firstMatchLink : `https://www.espncricinfo.com${firstMatchLink}`;
        }
      } catch (e) {
        console.warn('Fallback match discovery notice:', e.message);
      }
    }

    // URL normalization
    if (url) {
      if (!url.startsWith('http')) {
        url = `https://www.espncricinfo.com${url.startsWith('/') ? '' : '/'}${url}`;
      }
      url = url.replace(/\/live-cricket-score$/, '/full-scorecard');
      url = url.replace(/\/match-preview$/, '/full-scorecard');
      if (!url.endsWith('/full-scorecard') && !url.includes('?')) {
        url = `${url.replace(/\/+$/, '')}/full-scorecard`;
      }
    }

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

      // 2. Scrape Summary / Match Info (Filter out top carousel / ticker)
      const teams = [];
      const matchScoreElements = $('.ci-team-score').filter((_, el) => {
        return $(el).parents('[class*="carousel"], [class*="ticker"], [class*="swiper"], [class*="slick"], header, nav').length === 0;
      });

      const elementsToUse = matchScoreElements.length >= 2 ? matchScoreElements : $('.ci-team-score').slice(-2);

      elementsToUse.each((i, teamDiv) => {
        const teamName = $(teamDiv).find('p, a, span[class*="ds-text-title"], span[class*="ds-text-header"]').first().text().trim();
        const teamLogo = flagService.extractFlagFromElement($, teamDiv, teamName);

        // Extract score
        let score = $(teamDiv).find('strong').text().trim();
        const scoreContainer = $(teamDiv).find('.ds-text-right, div[class*="ds-text-compact"], div[class*="ds-text-header"], div[class*="ds-text-title"]').last();
        if (!score && scoreContainer.length) {
          scoreContainer.find('span').each((_, sp) => {
            const t = $(sp).text().trim();
            if (/\d+\/\d+|\d+/.test(t) && !t.includes('ov') && !t.includes('T:')) {
              score = t;
            }
          });
        }

        // Extract overs / target
        let overs = $(teamDiv).find('span[class*="ds-mr-0"], span[class*="ds-text-compact-xs"], span[class*="ds-text-body"], span[class*="ds-text-color-text-secondary"]').filter((_, sp) => {
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
      $('p[class*="ds-text-tight-s"], span[class*="ds-text-tight-s"], p[class*="ds-text-compact"], div[class*="ds-text-tight"], p, span').each((_, p) => {
        const text = $(p).text().trim();
        if (text.length < 120 && (text.includes('won by') || text.includes('tied') || text.includes('No result') || text.includes('Match scheduled') || text.includes('Innings break'))) {
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

      // Player of the match
      let playerOfTheMatch = '';
      $('span:contains("Player Of The Match"), div:contains("Player Of The Match")').each((_, el) => {
        const text = $(el).parent().text().replace(/\s+/g, ' ').trim();
        const match = text.match(/Player Of The Match\s*([A-Za-z\s]+)(?:,|$)/i);
        if (match && !playerOfTheMatch) {
          playerOfTheMatch = match[1].trim();
        }
      });

      // Match Details Key-Values
      const matchDetails = {};
      const detailKeys = [
        'Toss', 'Ground', 'Series', 'Season', 'Player Of The Match', 
        'Series result', 'Match number', 'Hours of play (local time)', 
        'Match days', 'Umpires', 'TV Umpire', 'Reserve Umpire', 'Match Referee'
      ];

      detailKeys.forEach(k => {
        $(`td:contains("${k}"), span:contains("${k}")`).each((_, el) => {
          if ($(el).text().trim() === k && !matchDetails[k]) {
            const parentRow = $(el).closest('tr');
            if (parentRow.length) {
              const links = parentRow.find('a');
              if (links.length > 1) {
                const names = [];
                links.each((__, a) => names.push($(a).text().trim()));
                matchDetails[k] = names.filter(Boolean).join(', ');
              } else {
                matchDetails[k] = parentRow.find('td').last().text().trim();
              }
            } else {
              matchDetails[k] = $(el).next().text().trim();
            }
          }
        });
      });

      if (sportsEvent) {
        if (!matchDetails['Series'] && sportsEvent.superEvent) {
          matchDetails['Series'] = sportsEvent.superEvent.name;
        }
        if (!venue && sportsEvent.location) {
          venue = sportsEvent.location.name;
        }
      }

      scorecardData.summary = {
        matchTitle: sportsEvent ? sportsEvent.name : $('h1').first().text().trim(),
        status: sportsEvent ? sportsEvent.eventStatus : '',
        result,
        venue,
        playerOfTheMatch,
        teams
      };

      scorecardData.details = matchDetails;

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

        // Extras, Total, Did Not Bat, Fall of Wickets for this innings
        let extras = null;
        let total = null;
        let didNotBat = [];
        let fallOfWickets = [];

        if (container.length) {
          container.find('tr, div').each((_, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').trim();
            if (text.startsWith('Extras') && !extras) {
              const match = text.match(/Extras\s*\((.*?)\)\s*(\d+)/i);
              if (match) {
                extras = { details: match[1].trim(), total: match[2].trim() };
              } else {
                extras = { details: '', total: text.replace('Extras', '').trim() };
              }
            } else if (text.startsWith('Total') && !total) {
              const match = text.match(/Total\s*(.*?)\s*(\d+\/\d+|\d+)/i);
              if (match) {
                total = { details: match[1].trim(), score: match[2].trim() };
              } else {
                total = { details: '', score: text.replace('Total', '').trim() };
              }
            } else if (text.startsWith('Did not bat') && didNotBat.length === 0) {
              didNotBat = text.replace('Did not bat', '').split(',').map(n => n.trim()).filter(Boolean);
            } else if (text.startsWith('Fall of wickets') && fallOfWickets.length === 0) {
              const raw = text.replace('Fall of wickets', '').trim();
              fallOfWickets = raw.split(/(?<=\))\s*,\s*|\s*,\s*(?=\d+-)/).map(f => f.trim()).filter(Boolean);
            }
          });
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
          if (firstCell && !firstCell.toLowerCase().includes('extras') && !firstCell.toLowerCase().includes('total') && !firstCell.toLowerCase().includes('did not bat') && !firstCell.toLowerCase().includes('fall of wickets')) {
            rows.push(rowData);
          }
        });

        if (rows.length > 0) {
          scorecardData.tables.push({
            title: tableTitle,
            type: tableType,
            headers: headers.filter(h => h.length > 0),
            rows: rows,
            extras,
            total,
            didNotBat,
            fallOfWickets
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

// Alias for lowercase c routing
scoreCardController.getScorecard = scoreCardController.getScoreCard;

module.exports = scoreCardController;
