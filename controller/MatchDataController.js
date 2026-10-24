const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

/**
 * Helper to extract match cards from Cricinfo series blocks (used for live and recent matches)
 */
function extractSeriesMatches(html) {
  const $ = cheerio.load(html);
  const response = [];

  $('.ds-w-full.ds-bg-fill-content-prime').each((i, seriesEl) => {
    const seriesTitle = $(seriesEl)
      .find('h2 span.ds-text-title-xs, h2')
      .first()
      .text()
      .trim();

    if (!seriesTitle) return;

    const matches = [];

    // Match cards inside series
    $(seriesEl)
      .find('.ds-border-b.ds-border-line')
      .each((j, matchEl) => {
        // Ensure this is a match card containing teams
        if ($(matchEl).find('.ci-team-score').length === 0) return;

        const match = {};

        // Link
        const linkEl = $(matchEl)
          .find('a[href*="/live-cricket-score"], a[href*="/full-scorecard"], a.ds-no-tap-higlight')
          .first();
        let link = linkEl.attr('href') || null;
        if (link && !link.startsWith('http')) {
          link = `https://www.espncricinfo.com${link}`;
        }
        match.link = link;

        // Status (e.g. RESULT, LIVE, scheduled time)
        let status = $(matchEl)
          .find('span.ds-uppercase, span[class*="ds-text-tight-xs"][class*="ds-uppercase"]')
          .first()
          .text()
          .trim();

        // Fallback to embedded schema.org JSON if status is empty
        if (!status) {
          const ldScript = $(matchEl).find('script[type="application/ld+json"]').first();
          if (ldScript.length) {
            try {
              const ld = JSON.parse(ldScript.text());
              status = ld.broadcastOfEvent?.eventStatus || ld.eventStatus || '';
            } catch (e) {
              // ignore
            }
          }
        }
        match.status = status;

        // Match info
        match.matchInfo = $(matchEl)
          .find('.ds-text-tight-xs.ds-text-typo-mid3')
          .first()
          .text()
          .trim();

        // Teams
        match.teams = [];
        $(matchEl).find('.ci-team-score').each((k, teamEl) => {
          const team = {};

          team.name = $(teamEl)
            .find('p.ds-text-tight-m, p')
            .first()
            .text()
            .trim();

          // Dynamic flag extraction with fallback to dynamic registry
          team.flag = flagService.extractFlagFromElement($, teamEl, team.name);

          const metaText = $(teamEl)
            .find('span.ds-text-compact-xs, span[class*="ds-mr-0"]')
            .text()
            .trim();

          let overs = '';
          let target = '';
          if (metaText) {
            const cleaned = metaText.replace(/[()]/g, '');
            cleaned.split(',').forEach((part) => {
              if (part.includes('ov')) overs = part.trim();
              if (part.includes('T:')) target = part.trim();
            });
          }
          team.overs = overs;
          team.target = target;

          const score = $(teamEl).find('strong').text().trim();
          team.score = score;
          team.fullScore = metaText ? `${score} ${metaText}`.trim() : score;

          match.teams.push(team);
        });

        // Result / preview text
        match.result = $(matchEl)
          .find('p.ds-text-tight-s.ds-font-medium, p.ds-text-tight-s')
          .first()
          .text()
          .trim();

        if (match.teams.length >= 2) {
          matches.push(match);
        }
      });

    if (matches.length > 0) {
      response.push({
        series: seriesTitle,
        matches
      });
    }
  });

  return response;
}

const MatchDataController = {
  getLiveMatches: async (req, res) => {
    const cacheKey = 'live_matches';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const html = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-score', {
        waitMs: 1500
      });
      const data = extractSeriesMatches(html);

      // Cache live matches for 45 seconds
      cacheService.set(cacheKey, data, 45 * 1000);

      res.status(200).json(data);
    } catch (err) {
      console.error('getLiveMatches error:', err.message);
      res.status(500).json({ error: 'Scraping failed', message: err.message });
    }
  },

  getRecentMatches: async (req, res) => {
    const cacheKey = 'recent_matches';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const html = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-match-results', {
        waitMs: 1500
      });
      const data = extractSeriesMatches(html);

      // Cache recent matches for 5 minutes
      cacheService.set(cacheKey, data, 5 * 60 * 1000);

      res.status(200).json(data);
    } catch (err) {
      console.error('getRecentMatches error:', err.message);
      res.status(500).json({ error: 'Scraping failed', message: err.message });
    }
  },

  getUpcomingMatches: async (req, res) => {
    let rawDate = req.query.date ? String(req.query.date).trim() : '';
    let formattedDate = '';

    if (rawDate && rawDate !== 'undefined') {
      // If provided as YYYY-MM-DD, convert to DD-MM-YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [year, month, day] = rawDate.split('-');
        formattedDate = `${day}-${month}-${year}`;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
        formattedDate = rawDate;
      }
    }

    const cacheKey = `upcoming_matches_${formattedDate || 'all'}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const url = formattedDate
        ? `https://www.espncricinfo.com/live-cricket-match-schedule-fixtures?date=${formattedDate}`
        : 'https://www.espncricinfo.com/live-cricket-match-schedule-fixtures';

      const html = await fetchPageHtml(url, { waitMs: 1500 });
      const $ = cheerio.load(html);
      const response = [];

      $('.ds-mb-6').each((i, dateBlock) => {
        const date = $(dateBlock).find('span[class*="ds-text-tight-s"]').first().text().trim();

        $(dateBlock)
          .find('div.ds-bg-fill-content-prime')
          .each((j, cardEl) => {
            const teamsEl = $(cardEl).find('p.ds-text-compact-s').first();
            let teams = teamsEl.clone().children().remove().end().text().trim();
            if (!teams) teams = teamsEl.text().trim();
            if (!teams) return;

            // Dynamically resolve team details and flags
            const teamParts = teams.split(/\s+(?:vs|v)\s+/i);
            const teamDetails = teamParts.map((tName) => {
              const cleanName = tName.trim();
              return {
                name: cleanName,
                flag: flagService.getFlag(cleanName)
              };
            });

            const venueInfoFull = $(cardEl).find('div.ds-text-tight-xs').first().text().trim();
            const venueParts = venueInfoFull.split(',');
            const venueInfo = venueParts.slice(1).join(',').trim() || venueParts[0] || '';

            // Series Name
            const seriesLink = $(cardEl).find('a[href*="/series/"]').last();
            const seriesName = seriesLink.attr('title') || seriesLink.text().trim();

            // Start Time
            const timeEl = $(cardEl).find('time').first();
            const startTime = timeEl.text().trim() || $(cardEl).find('span[class*="ds-text-compact-xs"]').first().text().trim();

            // Link
            const linkEl = $(cardEl).find('a[href*="/live-cricket-score"], a[href*="/match/"]').first();
            let link = linkEl.attr('href') || null;
            if (link && !link.startsWith('http')) {
              link = `https://www.espncricinfo.com${link}`;
            }

            response.push({
              date,
              teams,
              teamDetails,
              venueInfo,
              seriesName,
              startTime,
              link
            });
          });
      });

      // Cache upcoming matches for 10 minutes
      cacheService.set(cacheKey, response, 10 * 60 * 1000);

      res.status(200).json(response);
    } catch (err) {
      console.error('getUpcomingMatches error:', err.message);
      res.status(500).json({ error: 'Scraping failed', message: err.message });
    }
  }
};

module.exports = MatchDataController;
