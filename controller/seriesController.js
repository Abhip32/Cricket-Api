const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

/**
 * Controller for Tournaments, Series, and Tournament Standings / Points Tables
 * Powered directly by ESPN's public endpoints (< 150ms latency)
 */
const seriesController = {
  /**
   * Get all currently active series and tournaments
   * Endpoint: GET /getSeries or GET /series or GET /getTournaments
   */
  getSeriesList: async (req, res) => {
    const cacheKey = 'active_cricket_series';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      const url = 'https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Failed to retrieve series from ESPN' });
      }

      const data = await resp.json();
      const rawLeagues = data.sports?.[0]?.leagues || [];

      const series = rawLeagues.map((l) => ({
        id: l.id,
        name: l.name || 'Cricket Series',
        slug: l.slug || '',
        abbreviation: l.abbreviation || '',
        isTournament: Boolean(l.isTournament),
        season: l.season?.year || null,
        eventsCount: l.events?.length || 0,
        events: (l.events || []).map((e) => ({
          id: e.id,
          name: e.name || '',
          status: e.fullStatus?.type?.description || e.status || '',
          state: e.fullStatus?.type?.state || '',
          competitors: (e.competitors || []).map((c) => ({
            name: c.displayName || c.name || '',
            score: c.score || '',
            flag: c.logo || flagService.getFlag(c.displayName || c.name || '')
          }))
        }))
      }));

      cacheService.set(cacheKey, series, 10 * 60 * 1000); // 10 min TTL
      return res.status(200).json(series);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to retrieve active series list',
        message: err.message
      });
    }
  },

  /**
   * Get tournament standings / points table by leagueId
   * Endpoint: GET /getStandings or GET /standings or GET /series/:leagueId/standings
   */
  getStandings: async (req, res) => {
    const leagueId = req.params.leagueId || req.query.leagueId || req.query.id;
    if (!leagueId) {
      return res.status(400).json({
        error: 'leagueId is required',
        message: 'Provide a tournament or series ID via ?leagueId=... (e.g. ?leagueId=8043 or ?leagueId=21284)'
      });
    }

    const cleanLeagueId = String(leagueId).trim();
    const cacheKey = `series_standings_${cleanLeagueId}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      const url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${cleanLeagueId}/scoreboard`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        if (resp.status === 404) {
          return res.status(404).json({ error: 'League or tournament scoreboard not found', leagueId: cleanLeagueId });
        }
        return res.status(resp.status).json({ error: 'Failed to retrieve tournament standings from ESPN' });
      }

      const data = await resp.json();
      const leagueName = data.leagues?.[0]?.name || 'Cricket Tournament';
      const rawStandings = data.standings || [];

      const standings = rawStandings.map((s) => {
        const statsMap = {};
        (s.stats || []).forEach((st) => {
          statsMap[st.name] = st.displayValue || st.value;
        });

        const teamName = s.team?.displayName || s.team?.name || '';
        const teamId = s.team?.id;
        const logo =
          s.team?.logos?.[0]?.href ||
          (teamId ? `https://a.espncdn.com/i/teamlogos/cricket/500/${teamId}.png` : null) ||
          (teamName ? flagService.getFlag(teamName) : null);

        if (teamName && logo) {
          flagService.registerFlag(teamName, logo);
        }

        return {
          team: {
            id: teamId || null,
            name: teamName,
            abbreviation: s.team?.shortDisplayName || s.team?.abbreviation || '',
            logo,
            isNational: Boolean(s.team?.isNational)
          },
          rank: statsMap.rank ? parseInt(statsMap.rank, 10) : null,
          points: statsMap.matchPoints || statsMap.points || '0',
          stats: statsMap,
          raw: s
        };
      });

      // Sort by rank ascending if rank exists
      standings.sort((a, b) => {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        return 0;
      });

      const response = {
        leagueId: cleanLeagueId,
        tournament: leagueName,
        standingsCount: standings.length,
        standings
      };

      cacheService.set(cacheKey, response, 5 * 60 * 1000); // 5 min TTL
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to retrieve tournament standings',
        message: err.message
      });
    }
  },

  /**
   * Get all participating teams for a series or tournament
   * Endpoint: GET /getSeriesTeams or GET /series/:leagueId/teams
   */
  getSeriesTeams: async (req, res) => {
    const leagueId = req.params.leagueId || req.query.leagueId || req.query.id;
    if (!leagueId) {
      return res.status(400).json({
        error: 'leagueId is required',
        message: 'Provide a tournament or series ID via ?leagueId=... (e.g. ?leagueId=8043)'
      });
    }

    const cleanLeagueId = String(leagueId).trim();
    const cacheKey = `series_teams_${cleanLeagueId}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      const url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${cleanLeagueId}/scoreboard`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Failed to retrieve series teams from ESPN' });
      }

      const data = await resp.json();
      const leagueName = data.leagues?.[0]?.name || 'Cricket Series';
      const rawTeams = data.teams || [];

      const teams = rawTeams.map((t) => {
        const teamName = t.displayName || t.name || '';
        const teamId = t.id;
        const logo =
          t.logos?.[0]?.href ||
          (teamId ? `https://a.espncdn.com/i/teamlogos/cricket/500/${teamId}.png` : null) ||
          (teamName ? flagService.getFlag(teamName) : null);

        if (teamName && logo) {
          flagService.registerFlag(teamName, logo);
        }

        return {
          id: teamId || null,
          name: teamName,
          abbreviation: t.shortDisplayName || t.abbreviation || '',
          location: t.location || '',
          logo,
          raw: t
        };
      });

      const response = {
        leagueId: cleanLeagueId,
        tournament: leagueName,
        teamsCount: teams.length,
        teams
      };

      cacheService.set(cacheKey, response, 15 * 60 * 1000); // 15 min TTL
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to retrieve series teams',
        message: err.message
      });
    }
  }
};

module.exports = seriesController;
