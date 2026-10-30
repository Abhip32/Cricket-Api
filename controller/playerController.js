const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

/**
 * Controller for Player Profiles, Player Search, and Universal Cricket Search
 * Powered directly by ESPN's public endpoints (< 120ms latency)
 */
const playerController = {
  /**
   * Search for cricketers by name
   * Endpoint: GET /player/search?query=...&limit=...
   */
  searchPlayers: async (req, res) => {
    const query = req.query.query || req.query.q || req.query.name;
    if (!query || !query.trim()) {
      return res.status(400).json({
        error: 'Query parameter is required',
        message: 'Provide a player name via ?query=... (e.g. ?query=Kohli)'
      });
    }

    const trimmedQuery = query.trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);
    const cacheKey = `player_search_${trimmedQuery.toLowerCase()}_${limit}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      const url = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(trimmedQuery)}&type=player&limit=${limit}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Failed to search players from ESPN' });
      }

      const data = await resp.json();
      const playerGroup = data.results?.find((r) => r.type === 'player');
      const rawPlayers = playerGroup?.contents || [];

      const players = rawPlayers.map((p) => {
        // Extract numeric ID from UID format "s:200~a:253802" or direct ID
        const uidMatch = p.uid ? p.uid.match(/~a:(\d+)/) : null;
        const playerId = uidMatch ? uidMatch[1] : p.id;
        const headshot =
          p.image?.default ||
          (playerId ? `https://a.espncdn.com/i/headshots/cricket/players/full/${playerId}.png` : null);

        return {
          id: playerId,
          name: p.displayName || '',
          team: p.subtitle || '',
          sport: p.sport || 'cricket',
          headshot,
          link: p.link?.web || null,
          raw: p
        };
      });

      const response = {
        query: trimmedQuery,
        totalFound: playerGroup?.totalFound || players.length,
        players
      };

      cacheService.set(cacheKey, response, 15 * 60 * 1000); // 15 min TTL
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to search players',
        message: err.message
      });
    }
  },

  /**
   * Get detailed player profile by athlete ID
   * Endpoint: GET /player/:id or GET /getPlayer?id=...
   */
  getPlayerById: async (req, res) => {
    const id = req.params.id || req.query.id;
    if (!id || !String(id).trim()) {
      return res.status(400).json({
        error: 'Player ID is required',
        message: 'Provide an athlete ID in the URL path (/player/:id) or via ?id=... (e.g. /player/253802)'
      });
    }

    const playerId = String(id).trim();
    const cacheKey = `player_profile_${playerId}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      const url = `https://site.web.api.espn.com/apis/common/v3/sports/cricket/athletes/${playerId}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        if (resp.status === 404) {
          return res.status(404).json({ error: 'Player not found', id: playerId });
        }
        return res.status(resp.status).json({ error: 'Failed to retrieve player profile from ESPN' });
      }

      const data = await resp.json();
      const a = data.athlete;
      if (!a) {
        return res.status(404).json({ error: 'Player data not found in response', id: playerId });
      }

      const teamName = a.team?.displayName || a.team?.name || '';
      const teamId = a.team?.id;
      const teamFlag =
        a.flag?.href ||
        (teamId ? `https://a.espncdn.com/i/teamlogos/cricket/500/${teamId}.png` : null) ||
        (teamName ? flagService.getFlag(teamName) : null);

      if (teamName && teamFlag) {
        flagService.registerFlag(teamName, teamFlag);
      }

      const profile = {
        id: a.id,
        name: a.displayName || a.fullName || '',
        fullName: a.fullName || a.displayName || '',
        shortName: a.shortName || '',
        dateOfBirth: a.displayDOB || null,
        age: a.age || null,
        gender: a.gender || 'M',
        position: a.position?.name || 'Cricketer',
        positionAbbr: a.position?.abbreviation || '',
        battingStyle: a.batStyle?.[0]?.description || null,
        battingStyleShort: a.batStyle?.[0]?.shortDescription || null,
        bowlingStyle: a.bowlStyle?.[0]?.description || null,
        bowlingStyleShort: a.bowlStyle?.[0]?.shortDescription || null,
        headshot:
          a.headshot?.href ||
          `https://a.espncdn.com/i/headshots/cricket/players/full/${a.id}.png`,
        team: {
          id: teamId || null,
          name: teamName,
          abbreviation: a.team?.abbreviation || a.team?.shortDisplayName || '',
          color: a.team?.color || null,
          flag: teamFlag
        },
        profileUrl: a.links?.[0]?.href || null,
        raw: a
      };

      cacheService.set(cacheKey, profile, 60 * 60 * 1000); // 1 hour TTL
      return res.status(200).json(profile);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to retrieve player profile',
        message: err.message
      });
    }
  },

  /**
   * Universal search across players, teams, leagues, and series
   * Endpoint: GET /search?query=...&type=...&limit=...
   */
  universalSearch: async (req, res) => {
    const query = req.query.query || req.query.q;
    if (!query || !query.trim()) {
      return res.status(400).json({
        error: 'Query parameter is required',
        message: 'Provide a search query via ?query=... (e.g. ?query=Australia)'
      });
    }

    const trimmedQuery = query.trim();
    const type = req.query.type ? String(req.query.type).trim() : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);
    const cacheKey = `universal_search_${trimmedQuery.toLowerCase()}_${type || 'all'}_${limit}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      let url = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(trimmedQuery)}&limit=${limit}`;
      if (type) {
        url += `&type=${encodeURIComponent(type)}`;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Failed to query ESPN search' });
      }

      const data = await resp.json();
      const results = {};

      for (const group of data.results || []) {
        const groupType = group.type;
        results[groupType] = (group.contents || []).map((item) => {
          let image = item.image?.default || null;
          if (groupType === 'player' && !image) {
            const uidMatch = item.uid ? item.uid.match(/~a:(\d+)/) : null;
            const pid = uidMatch ? uidMatch[1] : item.id;
            image = pid ? `https://a.espncdn.com/i/headshots/cricket/players/full/${pid}.png` : null;
          }

          return {
            id: item.id,
            uid: item.uid,
            name: item.displayName || item.name || '',
            subtitle: item.subtitle || '',
            type: groupType,
            link: item.link?.web || null,
            image
          };
        });
      }

      const response = {
        query: trimmedQuery,
        totalFound: data.totalFound || 0,
        resultTypes: data.resultTypes || [],
        results
      };

      cacheService.set(cacheKey, response, 10 * 60 * 1000); // 10 min TTL
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to perform search',
        message: err.message
      });
    }
  }
};

module.exports = playerController;
