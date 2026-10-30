const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

/**
 * Ultra-fast direct ESPN Scoreboard Header API (< 100ms)
 * Immune to Akamai 403 blocks on Vercel / Cloud lambdas.
 */
async function fetchEspnLiveMatches(options = {}) {
  try {
    let url = 'https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket';
    if (options.league) url += `&league=${encodeURIComponent(options.league)}`;
    if (options.group) url += `&group=${encodeURIComponent(options.group)}`;
    if (options.region) url += `&region=${encodeURIComponent(options.region)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const leagues = json.sports?.[0]?.leagues || [];
    const seriesList = [];

    for (const l of leagues) {
      const seriesTitle = l.name || 'Cricket Series';
      const matches = [];

      for (const ev of l.events || []) {
        const state = ev.fullStatus?.type?.state;
        if (state === 'in' || ev.status === 'live' || ev.fullStatus?.type?.name === 'STATUS_IN_PROGRESS') {
          const competitors = ev.competitors || [];
          const teams = competitors.map((c) => {
            const name = c.displayName || c.name || 'Team';
            const flag = c.logo || flagService.getFlag(name);
            if (name && flag) {
              flagService.registerFlag(name, flag);
            }

            const rawScore = c.score || '';
            let score = rawScore;
            let overs = c.overs || '';
            let target = '';

            const oversMatch = rawScore.match(/\(([\d\.\/]+\s*ov[^\)]*)\)/i);
            if (oversMatch) {
              overs = oversMatch[1].replace(/,\s*target.*$/i, '').trim();
              score = rawScore.replace(/\s*\([^\)]*\)/g, '').trim();
            }
            const targetMatch = rawScore.match(/target\s*(\d+)/i);
            if (targetMatch) {
              target = targetMatch[1];
            }

            return {
              name,
              score,
              overs,
              target,
              fullScore: rawScore,
              flag
            };
          });

          const link = ev.links?.[0]?.href || `https://www.espncricinfo.com/series/${l.id}/${ev.id}`;
          matches.push({
            link,
            status: ev.fullStatus?.type?.description || 'LIVE',
            matchInfo: ev.name || '',
            teams,
            result: ev.statusText || ev.fullStatus?.type?.detail || '',
            raw: ev
          });
        }
      }

      if (matches.length > 0) {
        seriesList.push({ series: seriesTitle, matches });
      }
    }

    return seriesList.length > 0 ? seriesList : null;
  } catch (e) {
    return null;
  }
}

/**
 * Ultra-fast direct ESPN Recent Matches API (< 300ms)
 * Immune to Akamai 403 blocks on Vercel / Cloud lambdas.
 */
async function fetchEspnRecentMatches(options = {}) {
  try {
    const dates = [];
    const now = new Date();
    for (let i = 0; i <= 2; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}${mm}${dd}`);
    }

    const seriesMap = new Map();

    await Promise.all(
      dates.map(async (dt) => {
        try {
          let url = `https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=${dt}`;
          if (options.league) url += `&league=${encodeURIComponent(options.league)}`;
          if (options.group) url += `&group=${encodeURIComponent(options.group)}`;
          if (options.region) url += `&region=${encodeURIComponent(options.region)}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          clearTimeout(timer);
          if (!res.ok) return;
          const json = await res.json();
          const leagues = json.sports?.[0]?.leagues || [];

          for (const l of leagues) {
            const seriesTitle = l.name || 'Cricket Series';
            if (!seriesMap.has(seriesTitle)) {
              seriesMap.set(seriesTitle, []);
            }

            for (const ev of l.events || []) {
              const state = ev.fullStatus?.type?.state;
              if (
                state === 'post' ||
                ev.status === 'post' ||
                ev.fullStatus?.type?.name?.includes('FINAL') ||
                ev.fullStatus?.type?.name?.includes('RESULT')
              ) {
                const competitors = ev.competitors || [];
                const teams = competitors.map((c) => {
                  const name = c.displayName || c.name || 'Team';
                  const flag = c.logo || flagService.getFlag(name);
                  if (name && flag) {
                    flagService.registerFlag(name, flag);
                  }

                  const rawScore = c.score || '';
                  let score = rawScore;
                  let overs = c.overs || '';
                  let target = '';

                  const oversMatch = rawScore.match(/\(([\d\.\/]+\s*ov[^\)]*)\)/i);
                  if (oversMatch) {
                    overs = oversMatch[1].replace(/,\s*target.*$/i, '').trim();
                    score = rawScore.replace(/\s*\([^\)]*\)/g, '').trim();
                  }
                  const targetMatch = rawScore.match(/target\s*(\d+)/i);
                  if (targetMatch) {
                    target = targetMatch[1];
                  }

                  return {
                    name,
                    score,
                    overs,
                    target,
                    fullScore: rawScore,
                    flag
                  };
                });

                const link = ev.links?.[0]?.href || `https://www.espn.in/cricket/series/${l.id}/game/${ev.id}`;
                seriesMap.get(seriesTitle).push({
                  link,
                  status: ev.fullStatus?.type?.description || 'RESULT',
                  matchInfo: ev.name || '',
                  teams,
                  result: ev.statusText || ev.fullStatus?.type?.detail || '',
                  raw: ev
                });
              }
            }
          }
        } catch (e) {}
      })
    );

    const response = [];
    for (const [series, matches] of seriesMap.entries()) {
      if (matches.length > 0) {
        response.push({ series, matches });
      }
    }
    return response.length > 0 ? response : null;
  } catch (err) {
    return null;
  }
}

/**
 * Ultra-fast direct ESPN Upcoming Fixtures API (< 300ms)
 * Immune to Akamai 403 blocks on Vercel / Cloud lambdas.
 */
async function fetchEspnUpcomingMatches(reqDate, options = {}) {
  try {
    const dates = [];
    if (reqDate) {
      let cleaned = reqDate.replace(/-/g, '');
      if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
        if (Number(cleaned.slice(0, 2)) > 1900) {
          dates.push(cleaned);
        } else {
          const dd = cleaned.slice(0, 2);
          const mm = cleaned.slice(2, 4);
          const yyyy = cleaned.slice(4, 8);
          dates.push(`${yyyy}${mm}${dd}`);
        }
      }
    }

    if (dates.length === 0) {
      const now = new Date();
      for (let i = 0; i <= 3; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        dates.push(`${yyyy}${mm}${dd}`);
      }
    }

    const fixtures = [];
    const seenEventIds = new Set();

    await Promise.all(
      dates.map(async (dt) => {
        try {
          let url = `https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=${dt}`;
          if (options.league) url += `&league=${encodeURIComponent(options.league)}`;
          if (options.group) url += `&group=${encodeURIComponent(options.group)}`;
          if (options.region) url += `&region=${encodeURIComponent(options.region)}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          clearTimeout(timer);
          if (!res.ok) return;
          const json = await res.json();
          const leagues = json.sports?.[0]?.leagues || [];

          for (const l of leagues) {
            const seriesName = l.name || 'Cricket Series';
            for (const ev of l.events || []) {
              if (ev.id && seenEventIds.has(ev.id)) continue;
              const state = ev.fullStatus?.type?.state;
              if (state === 'pre' || ev.status === 'pre' || (ev.fullStatus?.type?.name && ev.fullStatus.type.name.includes('SCHEDULED'))) {
                if (ev.id) seenEventIds.add(ev.id);
                const competitors = ev.competitors || [];
                const teamDetails = competitors.map((c) => {
                  const name = c.displayName || c.name || 'Team';
                  const flag = c.logo || flagService.getFlag(name);
                  if (name && flag) flagService.registerFlag(name, flag);
                  return { name, flag };
                });
                const teams = teamDetails.map((t) => t.name).join(' vs ');
                const link = ev.links?.[0]?.href || `https://www.espn.in/cricket/series/${l.id}/game/${ev.id}`;
                const venueInfo = ev.venue?.fullName || l.name || '';
                const startTime = ev.date
                  ? new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Upcoming';
                const dateStr = ev.date ? new Date(ev.date).toDateString() : dt;

                fixtures.push({
                  date: dateStr,
                  teams,
                  teamDetails,
                  venueInfo,
                  seriesName,
                  startTime,
                  link,
                  matchInfo: ev.name || 'Fixture',
                  raw: ev
                });
              }
            }
          }
        } catch (e) {}
      })
    );

    return fixtures.length > 0 ? fixtures : null;
  } catch (err) {
    return null;
  }
}

/**
 * Ultra-fast direct __NEXT_DATA__ JSON extraction (< 20ms)
 * Cricinfo SSR pre-renders all matches, scores, and official CDN flags into script#__NEXT_DATA__
 */
function extractSeriesFromNextData(html) {
  if (!html || !html.includes('__NEXT_DATA__')) return null;

  try {
    const $ = cheerio.load(html);
    const nextDataRaw = $('script#__NEXT_DATA__').html();
    if (!nextDataRaw) return null;

    const json = JSON.parse(nextDataRaw);
    const matches = json.props?.appPageProps?.data?.content?.matches;
    if (!Array.isArray(matches) || matches.length === 0) return null;

    const seriesMap = new Map();

    for (const m of matches) {
      const seriesTitle = m.series?.longName || m.series?.name || 'Cricket Series';
      if (!seriesMap.has(seriesTitle)) {
        seriesMap.set(seriesTitle, []);
      }

      const teams = (m.teams || []).map((t) => {
        const teamObj = t.team || {};
        const teamName = teamObj.longName || teamObj.name || 'Team';
        const imgPath = teamObj.imageUrl || teamObj.image?.url;
        const flag = imgPath
          ? `https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50${imgPath}`
          : flagService.getFlag(teamName);

        if (teamName && flag) {
          flagService.registerFlag(teamName, flag);
        }

        const score = t.score || '';
        const overs = t.scoreInfo || '';
        const fullScore = overs ? `${score} (${overs})`.trim() : score;

        return {
          name: teamName,
          score,
          overs,
          target: '',
          fullScore,
          flag
        };
      });

      const seriesSlug = m.series?.slug || '';
      const matchSlug = m.slug || '';
      const link =
        seriesSlug && matchSlug
          ? `https://www.espncricinfo.com/series/${seriesSlug}/${matchSlug}-${m.objectId || m.id}`
          : '';

      const matchObj = {
        link,
        status: m.status || m.state || (m.stage === 'RUNNING' ? 'LIVE' : 'RESULT'),
        matchInfo: m.title || '',
        teams,
        result: m.statusText || ''
      };

      if (teams.length >= 2) {
        seriesMap.get(seriesTitle).push(matchObj);
      }
    }

    const response = [];
    for (const [series, matchesList] of seriesMap.entries()) {
      if (matchesList.length > 0) {
        response.push({ series, matches: matchesList });
      }
    }
    return response.length > 0 ? response : null;
  } catch (err) {
    return null;
  }
}

function categorizeFixture(m) {
  const cid = m.internationalClassId || m.generalClassId;
  const seriesName = (m.series?.longName || m.series?.name || '').toLowerCase();
  const title = (m.title || '').toLowerCase();

  if (cid === 9 || cid === 17 || seriesName.includes('women') || title.includes('women')) {
    return 'women';
  }
  if (cid === 1 || cid === 2 || cid === 3) {
    return 'international';
  }
  if (
    cid === 6 ||
    cid === 13 ||
    seriesName.includes('league') ||
    seriesName.includes('premier') ||
    seriesName.includes('bbl') ||
    seriesName.includes('ipl') ||
    seriesName.includes('super smash') ||
    seriesName.includes('t20')
  ) {
    return 't20leagues';
  }
  if (
    cid === 4 ||
    cid === 5 ||
    seriesName.includes('trophy') ||
    seriesName.includes('shield') ||
    seriesName.includes('championship')
  ) {
    return 'domestic';
  }
  return 'other';
}

/**
 * Ultra-fast direct __NEXT_DATA__ JSON extraction for upcoming fixtures
 */
function extractUpcomingFromNextData(html) {
  if (!html || !html.includes('__NEXT_DATA__')) return null;

  try {
    const $ = cheerio.load(html);
    const nextDataRaw = $('script#__NEXT_DATA__').html();
    if (!nextDataRaw) return null;

    const json = JSON.parse(nextDataRaw);
    const matches = json.props?.appPageProps?.data?.data?.content?.matches;
    if (!Array.isArray(matches) || matches.length === 0) return null;

    const response = [];
    for (const m of matches) {
      const teamsList = (m.teams || []).map((t) => {
        const teamObj = t.team || {};
        const name = teamObj.longName || teamObj.name || 'Team';
        const imgPath = teamObj.imageUrl || teamObj.image?.url;
        const flag = imgPath
          ? `https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50${imgPath}`
          : flagService.getFlag(name);

        if (name && flag) {
          flagService.registerFlag(name, flag);
        }

        return {
          name,
          abbreviation: teamObj.abbreviation || teamObj.shortName || name.slice(0, 3).toUpperCase(),
          flag
        };
      });

      const teamsStr = teamsList.map((t) => t.name).join(' vs ');
      const seriesSlug = m.series?.slug || '';
      const matchSlug = m.slug || '';
      const link =
        seriesSlug && matchSlug
          ? `https://www.espncricinfo.com/series/${seriesSlug}/${matchSlug}-${m.objectId || m.id}`
          : '';

      let dateStr = 'Upcoming';
      if (m.startDate) {
        try {
          const d = new Date(m.startDate);
          dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        } catch (e) {}
      }

      let startTime = 'TBD';
      if (m.startTime) {
        try {
          const t = new Date(m.startTime);
          startTime = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch (e) {}
      }

      const category = categorizeFixture(m);

      response.push({
        id: m.objectId || m.id || `${m.slug || 'fixture'}`,
        date: dateStr,
        startDate: m.startDate || null,
        startTime,
        category,
        format: m.format || 'CRICKET',
        stage: m.stage || '',
        matchInfo: m.title || 'Fixture',
        seriesName: m.series?.longName || m.series?.name || 'Tournament Series',
        venueInfo: m.ground?.name || m.ground?.smallName || 'Venue TBA',
        groundCity: m.ground?.town?.name || '',
        teams: teamsStr,
        teamDetails: teamsList,
        status: m.statusText || m.statusEng || 'Scheduled',
        link,
        raw: m
      });
    }

    return response.length > 0 ? response : null;
  } catch (err) {
    return null;
  }
}

/**
 * Fallback Cheerio parser if __NEXT_DATA__ is unavailable
 */
function extractSeriesMatches(html) {
  // 1. Check ultra-fast __NEXT_DATA__ first
  const nextDataResult = extractSeriesFromNextData(html);
  if (nextDataResult && nextDataResult.length > 0) {
    return nextDataResult;
  }

  // 2. Cheerio DOM fallback
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

    $(seriesEl)
      .find('.ds-border-b.ds-border-line')
      .each((j, matchEl) => {
        if ($(matchEl).find('.ci-team-score').length === 0) return;

        const match = {};

        const linkEl = $(matchEl)
          .find('a[href*="/live-cricket-score"], a[href*="/full-scorecard"], a.ds-no-tap-higlight')
          .first();
        let link = linkEl.attr('href') || null;
        if (link && !link.startsWith('http')) {
          link = `https://www.espncricinfo.com${link}`;
        }
        match.link = link;

        let status = $(matchEl)
          .find('span.ds-uppercase, span[class*="ds-text-tight-xs"][class*="ds-uppercase"]')
          .first()
          .text()
          .trim();

        if (!status) {
          const ldScript = $(matchEl).find('script[type="application/ld+json"]').first();
          if (ldScript.length) {
            try {
              const ld = JSON.parse(ldScript.text());
              status = ld.broadcastOfEvent?.eventStatus || ld.eventStatus || '';
            } catch (e) {}
          }
        }
        match.status = status;

        match.matchInfo = $(matchEl)
          .find('.ds-text-tight-xs.ds-text-typo-mid3')
          .first()
          .text()
          .trim();

        match.teams = [];
        $(matchEl).find('.ci-team-score').each((k, teamEl) => {
          const team = {};

          team.name = $(teamEl)
            .find('p.ds-text-tight-m, p')
            .first()
            .text()
            .trim();

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
    const league = req.query.league || req.query.leagueId || '';
    const group = req.query.group || '';
    const region = req.query.region || '';
    const options = { league, group, region };

    const cacheKey = `live_matches_${league || 'all'}_${group || 'all'}_${region || 'all'}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 1. Ultra-fast direct ESPN API (< 100ms, immune to Akamai 403 on cloud/Vercel)
      const espnData = await fetchEspnLiveMatches(options);
      if (espnData && espnData.length > 0) {
        cacheService.set(cacheKey, espnData, 45 * 1000);
        return res.status(200).json(espnData);
      }

      // 2. Cricinfo Fallback
      const html = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-score');
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
    const league = req.query.league || req.query.leagueId || '';
    const group = req.query.group || '';
    const region = req.query.region || '';
    const options = { league, group, region };

    const cacheKey = `recent_matches_${league || 'all'}_${group || 'all'}_${region || 'all'}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 1. Ultra-fast direct ESPN Recent Matches API (< 300ms)
      const espnRecent = await fetchEspnRecentMatches(options);
      if (espnRecent && espnRecent.length > 0) {
        cacheService.set(cacheKey, espnRecent, 5 * 60 * 1000);
        return res.status(200).json(espnRecent);
      }

      // 2. Cricinfo Fallback
      const html = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-match-results');
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
    const category = (req.query.category || req.query.tab || 'all').toLowerCase();
    const format = req.query.format ? req.query.format.toUpperCase() : null;
    const league = req.query.league || req.query.leagueId || '';
    const group = req.query.group || '';
    const region = req.query.region || '';
    const options = { league, group, region };

    const cacheKey = `espn_upcoming_only_${rawDate || 'all'}_${category}_${format || 'all'}_${league || 'all'}_${group || 'all'}_${region || 'all'}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 100% Direct ESPN Official Header API (< 250ms)
      let espnUpcoming = await fetchEspnUpcomingMatches(rawDate, options);
      if (espnUpcoming && espnUpcoming.length > 0) {
        if (category && category !== 'all') {
          espnUpcoming = espnUpcoming.filter((f) =>
            (f.category && f.category === category) ||
            f.seriesName.toLowerCase().includes(category) ||
            f.venueInfo.toLowerCase().includes(category)
          );
        }
        if (format && format !== 'ALL') {
          espnUpcoming = espnUpcoming.filter((f) =>
            (f.format && f.format.toUpperCase() === format) ||
            f.matchInfo.toUpperCase().includes(format) ||
            f.seriesName.toUpperCase().includes(format)
          );
        }
        cacheService.set(cacheKey, espnUpcoming, 5 * 60 * 1000);
        return res.status(200).json(espnUpcoming);
      }

      return res.status(200).json([]);
    } catch (err) {
      console.error('getUpcomingMatches error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve ESPN upcoming fixtures', message: err.message });
    }
  },

  getSchedule: async (req, res) => {
    let rawDate = req.query.date ? String(req.query.date).trim() : '';
    const category = (req.query.category || req.query.tab || 'all').toLowerCase();
    const format = req.query.format ? req.query.format.toUpperCase() : null;
    let formattedDate = '';

    if (rawDate && rawDate !== 'undefined') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [year, month, day] = rawDate.split('-');
        formattedDate = `${day}-${month}-${year}`;
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) {
        formattedDate = rawDate;
      }
    }

    const cacheKey = `schedule_fixtures_endpoint_${category}_${format || 'all'}_${formattedDate || 'all'}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 1. Primary Source: Cricinfo Official Schedule & Fixtures Feed
      const url = formattedDate
        ? `https://www.espncricinfo.com/live-cricket-match-schedule-fixtures?date=${formattedDate}`
        : 'https://www.espncricinfo.com/live-cricket-match-schedule-fixtures';

      const html = await fetchPageHtml(url);
      let response = extractUpcomingFromNextData(html);

      if (response && response.length > 0) {
        if (category && category !== 'all') {
          response = response.filter((f) => f.category === category);
        }
        if (format && format !== 'ALL') {
          response = response.filter((f) => (f.format || '').toUpperCase() === format);
        }
        cacheService.set(cacheKey, response, 10 * 60 * 1000);
        return res.status(200).json(response);
      }

      // 2. Direct ESPN Scoreboard Header API Fallback
      const espnUpcoming = await fetchEspnUpcomingMatches(formattedDate || rawDate);
      if (espnUpcoming && espnUpcoming.length > 0) {
        cacheService.set(cacheKey, espnUpcoming, 10 * 60 * 1000);
        return res.status(200).json(espnUpcoming);
      }

      return res.status(200).json([]);
    } catch (err) {
      console.error('getSchedule error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve tournament schedule', message: err.message });
    }
  }
};

module.exports = MatchDataController;
