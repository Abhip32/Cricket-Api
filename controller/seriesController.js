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
    const cacheKey = `series_standings_v2_${cleanLeagueId}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      // 1. Try official v2 standings endpoint (contains full 8+ teams, NRR, won, lost, ties, points, qualification)
      let tournamentName = 'Cricket Tournament';
      let standings = [];
      const groups = [];

      try {
        const v2Url = `https://site.api.espn.com/apis/v2/sports/cricket/${cleanLeagueId}/standings`;
        const v2Controller = new AbortController();
        const v2Timer = setTimeout(() => v2Controller.abort(), 4000);
        const v2Resp = await fetch(v2Url, {
          signal: v2Controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        clearTimeout(v2Timer);

        if (v2Resp.ok) {
          const v2Data = await v2Resp.json();
          tournamentName = v2Data.name || tournamentName;

          const entriesToProcess = [];
          if (Array.isArray(v2Data.children) && v2Data.children.length > 0) {
            v2Data.children.forEach((child) => {
              const grpName = child.name || '';
              const cEntries = child.standings?.entries || [];
              cEntries.forEach((ent) => {
                ent._group = grpName;
                entriesToProcess.push(ent);
              });
              if (grpName) {
                groups.push(grpName);
              }
            });
          } else if (Array.isArray(v2Data.standings?.entries)) {
            entriesToProcess.push(...v2Data.standings.entries);
          }

          if (entriesToProcess.length > 0) {
            standings = entriesToProcess.map((s, idx) => {
              const statsMap = {};
              (s.stats || []).forEach((st) => {
                const val = st.displayValue != null ? String(st.displayValue) : (st.value != null ? String(st.value) : '');
                statsMap[st.name] = val;
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

              const rank = statsMap.rank ? parseInt(statsMap.rank, 10) : idx + 1;
              const played = statsMap.matchesPlayed || statsMap.played || statsMap.gamesPlayed || statsMap.matches || '0';
              const won = statsMap.matchesWon || statsMap.wins || statsMap.won || statsMap.w || '0';
              const lost = statsMap.matchesLost || statsMap.losses || statsMap.lost || statsMap.l || '0';
              const tied = statsMap.matchesTied || statsMap.ties || statsMap.tied || statsMap.t || '0';
              const noResult = statsMap.noresult || statsMap.noResult || statsMap.nr || '0';
              const points = statsMap.matchPoints || statsMap.points || statsMap.pts || '0';
              const netrr = statsMap.netrr || statsMap.netRunRate || statsMap.nrr || '0.000';
              const isQualified = statsMap.qualified === 'Y' || statsMap.qualified === '1' || statsMap.qualified === 'true' || Boolean(s.note?.color);

              return {
                team: {
                  id: teamId || null,
                  name: teamName,
                  abbreviation: s.team?.abbreviation || s.team?.shortDisplayName || '',
                  logo,
                  isNational: Boolean(s.team?.isNational)
                },
                rank,
                points,
                played,
                won,
                lost,
                tied,
                noResult,
                netrr,
                qualified: isQualified,
                runsFor: statsMap.for || '',
                runsAgainst: statsMap.against || '',
                stats: {
                  ...statsMap,
                  played,
                  won,
                  lost,
                  tied,
                  noResult,
                  netRunRate: netrr,
                  nrr: netrr,
                  points
                },
                group: s._group || null,
                raw: s
              };
            });
          }
        }
      } catch (e) {
        // Fallback to scoreboard
      }

      // 2. If v2 standings did not return any entries, fallback to site scoreboard
      if (!standings || standings.length === 0) {
        const sbUrl = `https://site.api.espn.com/apis/site/v2/sports/cricket/${cleanLeagueId}/scoreboard`;
        const sbController = new AbortController();
        const sbTimer = setTimeout(() => sbController.abort(), 4000);
        const sbResp = await fetch(sbUrl, {
          signal: sbController.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        clearTimeout(sbTimer);

        if (sbResp.ok) {
          const sbData = await sbResp.json();
          tournamentName = sbData.leagues?.[0]?.name || tournamentName;
          const rawStandings = sbData.standings || [];

          standings = rawStandings.map((s, idx) => {
            const statsMap = {};
            (s.stats || []).forEach((st) => {
              statsMap[st.name] = st.displayValue != null ? String(st.displayValue) : String(st.value ?? '');
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

            const rank = statsMap.rank ? parseInt(statsMap.rank, 10) : idx + 1;
            const played = statsMap.matchesPlayed || statsMap.played || statsMap.gamesPlayed || statsMap.matches || '-';
            const won = statsMap.matchesWon || statsMap.wins || statsMap.won || statsMap.w || '-';
            const lost = statsMap.matchesLost || statsMap.losses || statsMap.lost || statsMap.l || '-';
            const tied = statsMap.matchesTied || statsMap.ties || statsMap.tied || statsMap.t || '-';
            const noResult = statsMap.noresult || statsMap.noResult || statsMap.nr || '-';
            const points = statsMap.matchPoints || statsMap.points || '0';
            const netrr = statsMap.netrr || statsMap.netRunRate || statsMap.nrr || '-';

            return {
              team: {
                id: teamId || null,
                name: teamName,
                abbreviation: s.team?.shortDisplayName || s.team?.abbreviation || '',
                logo,
                isNational: Boolean(s.team?.isNational)
              },
              rank,
              points,
              played,
              won,
              lost,
              tied,
              noResult,
              netrr,
              qualified: statsMap.qualified === 'Y' || statsMap.qualified === '1',
              stats: statsMap,
              raw: s
            };
          });
        }
      }

      // Sort by rank ascending
      standings.sort((a, b) => {
        if (a.rank != null && b.rank != null) return a.rank - b.rank;
        return 0;
      });

      const response = {
        leagueId: cleanLeagueId,
        tournament: tournamentName,
        standingsCount: standings.length,
        groups: groups.length > 0 ? groups : undefined,
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
   * Get series/tournament fixtures (all tour matches in chronological order)
   * Endpoint: GET /series/fixtures or GET /series/:leagueId/fixtures or GET /getSeriesFixtures
   */
  getSeriesFixtures: async (req, res) => {
    const leagueId = req.params.leagueId || req.query.leagueId || req.query.id;
    if (!leagueId) {
      return res.status(400).json({
        error: 'leagueId is required',
        message: 'Provide a tournament or series ID via ?leagueId=... (e.g. ?leagueId=21284)'
      });
    }

    const cleanLeagueId = String(leagueId).trim();
    const cacheKey = `series_fixtures_${cleanLeagueId}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/cricket/${cleanLeagueId}/scoreboard`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      clearTimeout(timer);

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'Failed to retrieve series fixtures from ESPN' });
      }

      const data = await resp.json();
      const league = data.leagues?.[0] || {};
      const events = data.events || [];

      const fixtures = events.map((ev, index) => {
        const comp = ev.competitions?.[0] || {};
        const teams = (comp.competitors || []).map((c) => {
          const teamName = c.displayName || c.name || '';
          const teamId = c.id;
          const logo =
            c.logo ||
            (teamId ? `https://a.espncdn.com/i/teamlogos/cricket/500/${teamId}.png` : null) ||
            flagService.getFlag(teamName);

          return {
            id: teamId,
            name: teamName,
            abbreviation: c.abbreviation || '',
            score: c.score || '',
            overs: c.overs || '',
            winner: Boolean(c.winner),
            logo
          };
        });

        const statusType = comp.status?.type || ev.status?.type || {};
        const state = statusType.state || (statusType.completed ? 'post' : 'pre');

        return {
          id: ev.id,
          eventId: ev.id,
          matchNumber: index + 1,
          name: ev.name || '',
          shortName: ev.shortName || '',
          description: ev.description || comp.description || '',
          date: ev.date || '',
          venue: comp.venue?.fullName || comp.venue?.address?.city || '',
          state,
          statusText: statusType.shortDetail || statusType.detail || statusType.description || '',
          isLive: state === 'in',
          isCompleted: state === 'post',
          teams
        };
      });

      const response = {
        leagueId: cleanLeagueId,
        seriesName: league.name || 'Cricket Series',
        season: league.season?.year || null,
        totalMatches: fixtures.length,
        fixtures
      };

      cacheService.set(cacheKey, response, 3 * 60 * 1000); // 3 min TTL
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to retrieve series fixtures',
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
      const url = `https://site.api.espn.com/apis/site/v2/sports/cricket/${cleanLeagueId}/scoreboard`;
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
