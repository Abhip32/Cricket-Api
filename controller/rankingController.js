const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

const rankingsController = {
  getICCtables: async (req, res) => {
    const cacheKey = 'icc_team_rankings';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const html = await fetchPageHtml('https://www.espncricinfo.com/rankings/icc-team-ranking', {
        waitMs: 1200
      });
      const $ = cheerio.load(html);
      const tablesData = [];

      $('.ds-w-full.ds-bg-fill-content-prime').each((i, tableBlock) => {
        const tableTitle = $(tableBlock).find('h2').first().text().trim();
        const lastUpdated = $(tableBlock).find('span.ds-text-tight-s').first().text().trim();

        const tableRows = [];

        $(tableBlock).find('tbody tr').each((j, row) => {
          const tds = $(row).find('td');
          if (tds.length < 5) return;

          const pos = $(tds[0]).text().trim();
          const teamName = $(tds[1]).find('span.ds-text-tight-s').text().trim() || $(tds[1]).text().trim();
          
          let teamLink = $(tds[1]).find('a').attr('href') || null;
          if (teamLink && !teamLink.startsWith('http')) {
            teamLink = `https://www.espncricinfo.com${teamLink}`;
          }

          // Dynamic flag extraction with fallback to dynamic registry
          const teamLogo = flagService.extractFlagFromElement($, $(tds[1]), teamName);
          const matches = $(tds[2]).text().trim();
          const points = $(tds[3]).text().trim();
          const rating = $(tds[4]).text().trim();

          tableRows.push({
            pos,
            teamName,
            teamLink,
            teamLogo,
            matches,
            points,
            rating
          });
        });

        if (tableRows.length > 0) {
          tablesData.push({
            tableTitle,
            lastUpdated,
            teams: tableRows
          });
        }
      });

      // Cache ICC rankings for 1 hour
      cacheService.set(cacheKey, tablesData, 60 * 60 * 1000);

      res.status(200).json(tablesData);
    } catch (err) {
      console.error('getICCtables error:', err.message);
      res.status(500).json({ error: 'Failed to scrape ICC tables', message: err.message });
    }
  },

  getPlayersTable: async (req, res) => {
    const cacheKey = 'icc_player_rankings';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const html = await fetchPageHtml('https://www.espncricinfo.com/rankings/icc-player-ranking', {
        waitMs: 1200
      });
      const $ = cheerio.load(html);
      const tablesData = [];

      $('.ds-w-full.ds-bg-fill-content-prime').each((i, tableBlock) => {
        const tableTitle = $(tableBlock).find('h2').first().text().trim();
        const tableRows = [];

        $(tableBlock).find('tbody tr').each((j, row) => {
          const tds = $(row).find('td');
          if (tds.length < 4) return;

          const rank = $(tds[0]).text().trim();
          const playerName = $(tds[1]).find('span.ds-text-tight-s').text().trim() || $(tds[1]).text().trim();
          
          let playerLink = $(tds[1]).find('a').attr('href') || null;
          if (playerLink && !playerLink.startsWith('http')) {
            playerLink = `https://www.espncricinfo.com${playerLink}`;
          }

          const country = $(tds[2]).text().trim();
          const rating = $(tds[3]).find('span.ds-text-tight-s').text().trim() || $(tds[3]).text().trim();

          tableRows.push({
            rank,
            playerName,
            playerLink,
            country,
            rating
          });
        });

        if (tableRows.length > 0) {
          tablesData.push({
            tableTitle,
            players: tableRows
          });
        }
      });

      // Cache player rankings for 1 hour
      cacheService.set(cacheKey, tablesData, 60 * 60 * 1000);

      res.status(200).json(tablesData);
    } catch (err) {
      console.error('getPlayersTable error:', err.message);
      res.status(500).json({ error: 'Failed to scrape player rankings', message: err.message });
    }
  }
};

module.exports = rankingsController;
