const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

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

        return { name, flag };
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

      response.push({
        date: dateStr,
        teams: teamsStr,
        teamDetails: teamsList,
        venueInfo: m.ground?.name || m.ground?.smallName || 'Venue TBA',
        seriesName: m.series?.longName || m.series?.name || 'Tournament Series',
        startTime,
        link,
        matchInfo: m.title || 'Fixture'
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
    const cacheKey = 'live_matches';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
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
    const cacheKey = 'recent_matches';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
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
    let formattedDate = '';

    if (rawDate && rawDate !== 'undefined') {
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

      const html = await fetchPageHtml(url);

      // 1. Try __NEXT_DATA__ first
      const nextDataUpcoming = extractUpcomingFromNextData(html);
      let response = nextDataUpcoming;

      // 2. Fall back to Cheerio if not in __NEXT_DATA__
      if (!response || response.length === 0) {
        const $ = cheerio.load(html);
        response = [];

        $('.ds-mb-6').each((i, dateBlock) => {
          const date = $(dateBlock).find('span[class*="ds-text-tight-s"]').first().text().trim();

          $(dateBlock)
            .find('div.ds-bg-fill-content-prime')
            .each((j, cardEl) => {
              const teamsEl = $(cardEl).find('p.ds-text-compact-s').first();
              let teams = teamsEl.clone().children().remove().end().text().trim();
              if (!teams) teams = teamsEl.text().trim();
              if (!teams) return;

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

              const seriesLink = $(cardEl).find('a[href*="/series/"]').last();
              const seriesName = seriesLink.attr('title') || seriesLink.text().trim();

              const timeEl = $(cardEl).find('time').first();
              const startTime = timeEl.text().trim() || $(cardEl).find('span[class*="ds-text-compact-xs"]').first().text().trim();

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
                link,
                matchInfo: 'Fixture'
              });
            });
        });
      }

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
