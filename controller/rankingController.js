const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

/**
 * Ultra-fast direct Cricbuzz ICC Rankings API (< 300ms)
 * Cricbuzz includes real player headshots (faceImageId) and team logos (imageId)
 * for all formats (Test, ODI, T20) across Batting, Bowling, All-rounder, and Teams.
 */
async function fetchCricbuzzRankings(category) {
  try {
    const url = `https://www.cricbuzz.com/cricket-stats/icc-rankings/men/${category}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    let targetScript = '';
    $('script').each((_, el) => {
      const content = $(el).html() || '';
      if (content.includes('formatTypesData')) {
        targetScript = content;
      }
    });

    if (!targetScript) return null;

    const m = targetScript.match(/self\.__next_f\.push\(\[1,\s*"([\s\S]*)"\]\)/);
    if (!m) return null;

    const unescaped = JSON.parse(`"${m[1]}"`);
    const idx = unescaped.indexOf('"formatTypesData":');
    if (idx === -1) return null;

    const startBrace = unescaped.indexOf('{', idx);
    let depth = 0;
    let endBrace = -1;
    for (let i = startBrace; i < unescaped.length; i++) {
      if (unescaped[i] === '{') depth++;
      else if (unescaped[i] === '}') {
        depth--;
        if (depth === 0) {
          endBrace = i;
          break;
        }
      }
    }
    const jsonStr = unescaped.substring(startBrace, endBrace + 1);
    return JSON.parse(jsonStr);
  } catch (err) {
    return null;
  }
}

const rankingsController = {
  getICCtables: async (req, res) => {
    const cacheKey = 'icc_team_rankings_cricbuzz';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 1. Fetch from Cricbuzz with high-res team flags
      const cricbuzzTeams = await fetchCricbuzzRankings('teams');
      if (cricbuzzTeams) {
        const formatMap = [
          { key: 'test', title: "ICC Men's Test Team Rankings" },
          { key: 'odi', title: "ICC Men's ODI Team Rankings" },
          { key: 't20', title: "ICC Men's T20I Team Rankings" }
        ];

        const tablesData = [];

        for (const fmt of formatMap) {
          const list = cricbuzzTeams[fmt.key]?.rank || [];
          if (list.length > 0) {
            const teams = list.map((item, idx) => {
              const pos = String(item.rank || idx + 1);
              const teamName = item.name || 'Team';
              let teamLogo = flagService.getFlag(teamName);
              if (item.imageId && item.imageId !== '$undefined') {
                teamLogo = `https://static.cricbuzz.com/a/img/v1/30x20/i1/c${item.imageId}/team.jpg`;
                flagService.registerFlag(teamName, teamLogo);
              }

              return {
                pos,
                rank: pos,
                teamName,
                teamLink: `https://www.cricbuzz.com/cricket-team/${item.id}`,
                teamLogo,
                flag: teamLogo,
                matches: item.matches && item.matches !== '$undefined' ? String(item.matches) : '—',
                points: item.points && item.points !== '$undefined' ? String(item.points) : '—',
                rating: item.rating && item.rating !== '$undefined' ? String(item.rating) : '—',
                raw: item
              };
            });

            tablesData.push({
              tableTitle: fmt.title,
              lastUpdated: 'Live Updated',
              teams
            });
          }
        }

        if (tablesData.length > 0) {
          cacheService.set(cacheKey, tablesData, 60 * 60 * 1000);
          return res.status(200).json(tablesData);
        }
      }

      // 2. Fallback to ESPN Scraping if Cricbuzz is unavailable
      const html = await fetchPageHtml('https://www.espncricinfo.com/rankings/icc-team-ranking');
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

          const teamLogo = flagService.extractFlagFromElement($, $(tds[1]), teamName);
          const matches = $(tds[2]).text().trim();
          const points = $(tds[3]).text().trim();
          const rating = $(tds[4]).text().trim();

          tableRows.push({
            pos,
            rank: pos,
            teamName,
            teamLink,
            teamLogo,
            flag: teamLogo,
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

      cacheService.set(cacheKey, tablesData, 60 * 60 * 1000);
      res.status(200).json(tablesData);
    } catch (err) {
      console.error('getICCtables error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve ICC tables', message: err.message });
    }
  },

  getPlayersTable: async (req, res) => {
    const cacheKey = 'icc_player_rankings_cricbuzz';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 1. Fetch Batting, Bowling, and All-Rounder in parallel from Cricbuzz
      const [battingData, bowlingData, allRounderData] = await Promise.all([
        fetchCricbuzzRankings('batting'),
        fetchCricbuzzRankings('bowling'),
        fetchCricbuzzRankings('all-rounder')
      ]);

      if (battingData || bowlingData || allRounderData) {
        const categories = [
          { data: battingData, role: 'Batting', roleKeyword: 'Batting' },
          { data: bowlingData, role: 'Bowling', roleKeyword: 'Bowling' },
          { data: allRounderData, role: 'All-Rounder', roleKeyword: 'All-Rounder' }
        ];

        const formatMap = [
          { key: 'test', prefix: "ICC Men's Test" },
          { key: 'odi', prefix: "ICC Men's ODI" },
          { key: 't20', prefix: "ICC Men's T20I" }
        ];

        const tablesData = [];

        for (const cat of categories) {
          if (!cat.data) continue;

          for (const fmt of formatMap) {
            const list = cat.data[fmt.key]?.rank || [];
            if (list.length > 0) {
              const players = list.map((item, idx) => {
                const rank = String(item.rank || idx + 1);
                const playerName = item.name || 'Player';
                const country = item.country && item.country !== '$undefined' ? item.country : '';
                const rating = item.rating && item.rating !== '$undefined' ? String(item.rating) : '—';
                const points = item.points && item.points !== '$undefined' ? String(item.points) : rating;
                
                let playerImage = null;
                if (item.faceImageId && item.faceImageId !== '$undefined') {
                  playerImage = `https://static.cricbuzz.com/a/img/v1/i1/c${item.faceImageId}/player.jpg?d=low&p=gthumb`;
                }

                return {
                  rank,
                  pos: rank,
                  playerName,
                  name: playerName,
                  playerLink: `https://www.cricbuzz.com/profiles/${item.id}`,
                  country,
                  team: country,
                  rating,
                  points,
                  playerImage,
                  image: playerImage,
                  flag: playerImage || flagService.getFlag(country),
                  trend: item.trend || '',
                  raw: item
                };
              });

              tablesData.push({
                tableTitle: `${fmt.prefix} ${cat.role} Rankings`,
                lastUpdated: 'Live Updated',
                players
              });
            }
          }
        }

        if (tablesData.length > 0) {
          cacheService.set(cacheKey, tablesData, 60 * 60 * 1000);
          return res.status(200).json(tablesData);
        }
      }

      // 2. Fallback to ESPN Scraping if Cricbuzz is unavailable
      const html = await fetchPageHtml('https://www.espncricinfo.com/rankings/icc-player-ranking');
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
            pos: rank,
            playerName,
            name: playerName,
            playerLink,
            country,
            team: country,
            rating,
            playerImage: null,
            image: null,
            flag: flagService.getFlag(country)
          });
        });

        if (tableRows.length > 0) {
          tablesData.push({
            tableTitle,
            players: tableRows
          });
        }
      });

      cacheService.set(cacheKey, tablesData, 60 * 60 * 1000);
      res.status(200).json(tablesData);
    } catch (err) {
      console.error('getPlayersTable error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve player rankings', message: err.message });
    }
  }
};

module.exports = rankingsController;
