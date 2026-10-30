const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&dagger;/g, '†')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/►/g, '')
    .trim();
}

function extractIdsFromUrl(inputUrl) {
  if (!inputUrl) return null;
  const m1 = inputUrl.match(/series\/(\d+)\/game\/(\d+)/);
  if (m1) return { leagueId: m1[1], eventId: m1[2] };
  const m2 = inputUrl.match(/series\/[^\/]+-(\d+)\/[^\/]+-(\d+)/);
  if (m2) return { leagueId: m2[1], eventId: m2[2] };
  const m3 = inputUrl.match(/series\/(\d+)\/(\d+)/);
  if (m3) return { leagueId: m3[1], eventId: m3[2] };
  const matches = [...inputUrl.matchAll(/(\d{4,9})/g)].map((m) => m[1]);
  if (matches.length >= 2) return { leagueId: matches[0], eventId: matches[1] };
  return null;
}

async function resolveMatchIds(req) {
  let leagueId = req.query.leagueId || req.params.leagueId;
  let eventId = req.query.eventId || req.params.eventId || req.params.id;

  if (leagueId && eventId) {
    return { leagueId: String(leagueId).trim(), eventId: String(eventId).trim() };
  }

  let inputUrl = req.query.url;
  if (inputUrl) {
    const ids = extractIdsFromUrl(inputUrl);
    if (ids) return ids;
  }

  // Fallback discovery to latest active match from scoreboard header
  try {
    const headerRes = await fetch(
      'https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (headerRes.ok) {
      const headerJson = await headerRes.json();
      const firstLeague = headerJson.sports?.[0]?.leagues?.[0];
      const firstEvent = firstLeague?.events?.[0];
      if (firstLeague?.id && firstEvent?.id) {
        return { leagueId: String(firstLeague.id), eventId: String(firstEvent.id) };
      }
    }
  } catch (e) {}

  return null;
}

async function fetchEspnSummaryRaw(leagueId, eventId) {
  try {
    const url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${leagueId}/summary?event=${eventId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchEspnCommentary(leagueId, eventId, limit = 100, page = 1, period = null) {
  try {
    let url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${leagueId}/playbyplay?event=${eventId}&limit=${limit}&page=${page}`;
    if (period) {
      url += `&period=${period}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    const items = json.commentary?.items || [];
    return items.map((item) => {
      const isWicket = Boolean(
        item.dismissal?.dismissal ||
        item.playType?.description?.toLowerCase().includes('out') ||
        item.shortText?.toLowerCase().includes('out')
      );
      const bowler = decodeHtmlEntities(item.bowler?.athlete?.displayName || '');
      const batsman = decodeHtmlEntities(item.batsman?.athlete?.displayName || '');
      const mediaId = item.mediaId && item.mediaId !== 0 ? item.mediaId : null;
      return {
        id: item.id,
        over: item.over?.overs || item.over?.actual || 0,
        ball: item.over?.ball || 0,
        shortText: decodeHtmlEntities(item.shortText || ''),
        text: decodeHtmlEntities(item.text || item.shortText || ''),
        runs: item.scoreValue ?? 0,
        isWicket,
        wicket: isWicket,
        dismissal: decodeHtmlEntities(item.dismissal?.text || ''),
        bowler,
        batsman,
        batter: batsman,
        team: item.team?.displayName || item.team?.name || '',
        period: item.periodText || `Innings ${item.period || 1}`,
        preText: decodeHtmlEntities(item.preText || ''),
        postText: decodeHtmlEntities(item.postText || ''),
        mediaId,
        videoClipUrl: mediaId ? `https://www.espn.com/video/clip/_/id/${mediaId}` : null,
        timestamp: item.date || null
      };
    });
  } catch (e) {
    return [];
  }
}

function getOrdinalSuffix(i) {
  const j = i % 10, k = i % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Hydrates wicket-by-wicket partnerships with actual batsman names, runs, and balls
 * by tracking crease batters against the batting order and dismissal timeline
 */
function hydrateInningsPartnerships(competitor, linescore, rosters) {
  const teamRoster = (rosters || []).find((r) => r.team?.id === competitor.team?.id)?.roster || [];
  const period = linescore.period || 1;
  const fowList = linescore.fow || [];
  const partList = linescore.partnerships || [];
  if (!partList || partList.length === 0) return [];

  const batters = [];
  for (const p of teamRoster) {
    const pLinescore = (p.linescores || []).find((l) => {
      const innNum = l.statistics?.categories?.find((cat) => cat.name === 'general')?.stats?.find((s) => s.name === 'inningsNumber')?.value;
      return innNum === period || l.period === period;
    });
    if (pLinescore) {
      const genStats = pLinescore.statistics?.categories?.find((cat) => cat.name === 'general')?.stats || [];
      const pos = genStats.find((s) => s.name === 'battingPosition')?.value || 99;
      const runs = genStats.find((s) => s.name === 'runs')?.value || 0;
      const balls = genStats.find((s) => s.name === 'ballsFaced')?.value || 0;
      batters.push({
        id: p.athlete?.id || null,
        name: p.athlete?.displayName || p.athlete?.name || '',
        pos: Number(pos),
        totalRuns: Number(runs),
        totalBalls: Number(balls),
        headshot:
          p.athlete?.headshot?.href ||
          (p.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${p.athlete.id}.png` : null)
      });
    }
  }
  batters.sort((a, b) => a.pos - b.pos);

  let b1 = batters[0] || null;
  let b2 = batters[1] || null;
  let nextBatterIdx = 2;

  return partList.map((p, i) => {
    const wktNum = p.wicketNumber || (i + 1);
    const fow = fowList.find((f) => f.wicketNumber === wktNum);
    const partRuns = Number(p.runs) || 0;

    const outBatsmanName = fow?.athlete?.displayName || fow?.athlete?.name || '';
    const outBatsmanRuns = Number(fow?.runsScored) || 0;
    const outBatsmanBalls = Number(fow?.ballsFaced) || 0;
    const outBatsmanHeadshot =
      fow?.athlete?.headshot?.href ||
      (fow?.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${fow.athlete.id}.png` : null);

    let dismissed = null;
    let partner = null;

    if (outBatsmanName && b1 && b2) {
      if (b1.name.toLowerCase() === outBatsmanName.toLowerCase() || (b1.id && b1.id === fow.athlete?.id)) {
        dismissed = b1;
        partner = b2;
      } else if (b2.name.toLowerCase() === outBatsmanName.toLowerCase() || (b2.id && b2.id === fow.athlete?.id)) {
        dismissed = b2;
        partner = b1;
      }
    }

    if (!dismissed) {
      dismissed = b1 || { id: fow?.athlete?.id || null, name: outBatsmanName, headshot: outBatsmanHeadshot };
      partner = b2 || { id: null, name: '', headshot: null };
    }

    const partnerStandRuns = Math.max(0, partRuns - outBatsmanRuns);
    const approxBalls = p.overs ? Math.round(Number(p.overs) * 6) : 0;
    const partnerStandBalls = Math.max(0, approxBalls - outBatsmanBalls);

    const result = {
      wicketNumber: p.wicketNumber || (i + 1),
      wicketName: p.wicketName || `${i + 1}${getOrdinalSuffix(i + 1)}`,
      runs: partRuns,
      overs: p.overs,
      runRate: p.runRate,
      start: p.start,
      end: p.end,
      batsmen: [
        {
          id: dismissed.id || null,
          name: dismissed.name || outBatsmanName || '',
          runs: outBatsmanRuns,
          balls: outBatsmanBalls,
          headshot: dismissed.headshot || outBatsmanHeadshot || null
        },
        {
          id: partner.id || null,
          name: partner.name || '',
          runs: partnerStandRuns,
          balls: partnerStandBalls,
          headshot: partner.headshot || null
        }
      ]
    };

    if (nextBatterIdx < batters.length) {
      const incoming = batters[nextBatterIdx];
      nextBatterIdx++;
      b1 = partner;
      b2 = incoming;
    }

    return result;
  });
}

function formatEspnScorecard(data) {
  if (!data || !data.header) return null;

  const comp = data.header.competitions?.[0] || {};
  const statusType = comp.status?.type || {};
  const competitors = comp.competitors || [];
  const rosters = data.rosters || [];

  // Extract Leaders & MVP from ESPN summary payload
  const leaders = [];
  for (const teamLeaders of data.leaders || []) {
    const teamName = teamLeaders.team?.displayName || teamLeaders.team?.name || '';
    const teamLogo = teamLeaders.team?.logos?.[0]?.href || teamLeaders.team?.logo || flagService.getFlag(teamName);
    for (const ls of teamLeaders.linescores || []) {
      for (const cat of ls.leaders || []) {
        const catName = cat.displayName || cat.name || 'Leader';
        for (const l of cat.leaders || []) {
          const athlete = l.athlete || {};
          leaders.push({
            category: catName,
            team: teamName,
            teamLogo,
            name: athlete.displayName || athlete.fullName || athlete.name || 'Player',
            score: l.displayValue || l.value || '',
            image: athlete.headshot?.href || null,
            position: athlete.position?.name || '',
            id: athlete.id || null
          });
        }
      }
    }
  }

  const summary = {
    matchTitle: data.header.description || data.header.name || 'Match Scorecard',
    status: statusType.description || 'Live',
    result: statusType.detail || comp.statusText || '',
    venue: data.gameInfo?.venue?.fullName || '',
    playerOfTheMatch: leaders.find(l => l.category.toLowerCase().includes('run'))?.name || '',
    teams: competitors.map((c) => {
      const name = c.team?.displayName || c.team?.name || 'Team';
      const logo = c.team?.logos?.[0]?.href || c.team?.logo || flagService.getFlag(name);
      return {
        teamName: name,
        teamLogo: logo,
        score: c.score || '',
        overs: c.overs || ''
      };
    })
  };

  const details = {};
  if (data.gameInfo?.venue?.fullName) {
    details['Venue'] = data.gameInfo.venue.fullName;
  }
  if (data.gameInfo?.officials && data.gameInfo.officials.length > 0) {
    const umpires = data.gameInfo.officials
      .filter((o) => o.position?.name?.includes('umpire') && !o.position?.name?.includes('reserve'))
      .map((o) => o.displayName);
    if (umpires.length > 0) details['Umpires'] = umpires.join(', ');

    const ref = data.gameInfo.officials.find((o) => o.position?.name?.includes('referee'));
    if (ref) details['Match Referee'] = ref.displayName;
  }

  // Extract Squads
  const squads = {};
  for (const r of rosters) {
    const teamName = r.team?.displayName || r.team?.name || 'Team';
    const players = (r.roster || []).map((p) => ({
      name: p.athlete?.displayName || p.athlete?.name || 'Player',
      role: p.athlete?.position?.name || 'Player',
      image: p.athlete?.headshot?.href || null,
      id: p.athlete?.id || null
    }));
    squads[teamName] = players;
  }

  const tables = [];

  // Determine all innings periods played across competitors
  const periods = new Set();
  for (const c of competitors) {
    for (const ls of c.linescores || []) {
      if (ls.period) periods.add(ls.period);
    }
  }
  const sortedPeriods = Array.from(periods).sort((a, b) => a - b);

  for (const period of sortedPeriods) {
    // Identify which team batted in this period
    const battingComp =
      competitors.find((c) => {
        const ls = (c.linescores || []).find((l) => l.period === period);
        return ls && (Number(ls.runs) > 0 || Number(ls.wickets) > 0 || (ls.fow && ls.fow.length > 0));
      }) || competitors[0];

    const bowlingComp = competitors.find((c) => c !== battingComp) || competitors[1];

    const battingRoster = rosters.find((r) => r.team?.id === battingComp?.team?.id)?.roster || [];
    const bowlersRoster = rosters.find((r) => r.team?.id === bowlingComp?.team?.id)?.roster || [];

    const battingLinescore = (battingComp?.linescores || []).find((l) => l.period === period);

    // 1. Batting Table
    const battingRows = [];
    for (const p of battingRoster) {
      const ls = (p.linescores || []).find((l) => {
        const innNum = l.statistics?.categories?.find((c) => c.name === 'general')?.stats?.find((s) => s.name === 'inningsNumber')?.value;
        return innNum === period || l.period === period;
      });

      if (ls && ls.statistics) {
        const genStats = ls.statistics.categories?.find((c) => c.name === 'general')?.stats || [];
        const batted = genStats.find((s) => s.name === 'batted')?.value;
        const pos = genStats.find((s) => s.name === 'battingPosition')?.value || 99;
        const runs = genStats.find((s) => s.name === 'runs')?.value ?? 0;
        const balls = genStats.find((s) => s.name === 'ballsFaced')?.value ?? 0;
        const fours = genStats.find((s) => s.name === 'fours')?.value ?? 0;
        const sixes = genStats.find((s) => s.name === 'sixes')?.value ?? 0;
        const sr =
          genStats.find((s) => s.name === 'strikeRate')?.displayValue ||
          (balls > 0 ? ((runs / balls) * 100).toFixed(1) : '-');

        const nested = ls.linescores?.[0];
        const dismissal =
          nested?.statistics?.batting?.outDetails?.shortText ||
          ls.statistics?.batting?.outDetails?.shortText ||
          (batted ? 'not out' : 'did not bat');

        if (batted || dismissal !== 'did not bat') {
          battingRows.push({
            order: pos,
            Batting: p.athlete?.displayName || p.athlete?.name || 'Player',
            col_1: dismissal,
            R: String(runs),
            B: String(balls),
            '4s': String(fours),
            '6s': String(sixes),
            SR: String(sr)
          });
        }
      }
    }

    battingRows.sort((a, b) => a.order - b.order);
    battingRows.forEach((r) => delete r.order);

    if (battingRows.length > 0) {
      const innRuns = battingLinescore?.runs || '0';
      const innWkts = battingLinescore?.wickets || '0';
      const innOvs = battingLinescore?.overs || '';
      const totalStr = `(${innWkts} wkts; ${innOvs} ovs)`;

      tables.push({
        title: `${battingComp?.team?.displayName || 'Team'} Batting`,
        type: 'Batting',
        headers: ['Batting', 'R', 'B', '4s', '6s', 'SR'],
        rows: battingRows,
        extras: { total: String(innRuns), details: '' },
        total: { score: `${innRuns}/${innWkts}`, runs: String(innRuns), details: totalStr }
      });
    }

    // 2. Bowling Table
    const bowlingRows = [];
    for (const p of bowlersRoster) {
      const ls = (p.linescores || []).find((l) => {
        const innNum = l.statistics?.categories?.find((c) => c.name === 'general')?.stats?.find((s) => s.name === 'inningsNumber')?.value;
        return innNum === period || l.period === period;
      });

      if (ls && ls.statistics) {
        const genStats = ls.statistics.categories?.find((c) => c.name === 'general')?.stats || [];
        const overs = genStats.find((s) => s.name === 'overs')?.displayValue;
        const pos = genStats.find((s) => s.name === 'bowlingPosition')?.value || 99;
        const maidens = genStats.find((s) => s.name === 'maidens')?.displayValue ?? '0';
        const conceded = genStats.find((s) => s.name === 'conceded')?.displayValue ?? '0';
        const wickets = genStats.find((s) => s.name === 'wickets')?.displayValue ?? '0';
        const econ = genStats.find((s) => s.name === 'economyRate')?.displayValue ?? '0.00';

        if (overs && Number(overs) > 0) {
          bowlingRows.push({
            order: pos,
            Bowling: p.athlete?.displayName || p.athlete?.name || 'Bowler',
            O: String(overs),
            M: String(maidens),
            R: String(conceded),
            W: String(wickets),
            ECON: String(econ)
          });
        }
      }
    }

    bowlingRows.sort((a, b) => a.order - b.order);
    bowlingRows.forEach((r) => delete r.order);

    if (bowlingRows.length > 0) {
      tables.push({
        title: `${bowlingComp?.team?.displayName || 'Opponent'} Bowling`,
        type: 'Bowling',
        headers: ['Bowling', 'O', 'M', 'R', 'W', 'ECON'],
        rows: bowlingRows
      });
    }
  }

  // Fallback to matchcards if rosters had no parsed rows
  if (tables.length === 0) {
    for (const mc of data.matchcards || []) {
      if (mc.headline === 'Batting') {
        const rows = (mc.playerDetails || []).map((p) => {
          const runs = Number(p.runs) || 0;
          const balls = Number(p.ballsFaced) || 0;
          const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '-';
          return {
            Batting: p.playerName || 'Player',
            col_1: p.dismissal || 'not out',
            R: String(p.runs ?? '0'),
            B: String(p.ballsFaced ?? '0'),
            '4s': String(p.fours ?? '0'),
            '6s': String(p.sixes ?? '0'),
            SR: sr
          };
        });

        tables.push({
          title: `${mc.teamName || 'Team'} Batting`,
          type: 'Batting',
          headers: ['Batting', 'R', 'B', '4s', '6s', 'SR'],
          rows,
          extras: { total: mc.runs || '0', details: mc.extras || '' },
          total: { score: mc.runs || '0', runs: mc.runs || '0', details: mc.total || '' }
        });
      } else if (mc.headline === 'Bowling') {
        const rows = (mc.playerDetails || []).map((p) => ({
          Bowling: p.playerName || 'Bowler',
          O: String(p.overs ?? '0'),
          M: String(p.maidens ?? '0'),
          R: String(p.conceded ?? '0'),
          W: String(p.wickets ?? '0'),
          ECON: String(p.economyRate ?? '0.00')
        }));

        tables.push({
          title: `${mc.teamName || 'Opponent'} Bowling`,
          type: 'Bowling',
          headers: ['Bowling', 'O', 'M', 'R', 'W', 'ECON'],
          rows
        });
      }
    }
  }

  // Extract Innings Partnerships, Fall of Wickets, and DRS Reviews
  const inningsPartnerships = [];
  const inningsFow = [];
  const drsReviews = [];

  for (const c of competitors) {
    const teamName = c.team?.displayName || c.team?.name || 'Team';
    for (const ls of c.linescores || []) {
      const innPeriod = ls.period || 1;
      const innScore = `${ls.runs || 0}/${ls.wickets || 0}`;
      const innOvers = ls.overs || '0';

      if (ls.partnerships && ls.partnerships.length > 0) {
        inningsPartnerships.push({
          team: teamName,
          period: innPeriod,
          score: innScore,
          overs: innOvers,
          partnerships: ls.partnerships.map((p) => ({
            wicketNumber: p.wicketNumber,
            wicketName: p.wicketName,
            runs: p.runs,
            overs: p.overs,
            runRate: p.runRate,
            start: p.start,
            end: p.end,
            batsmen: (p.batsmen || []).map((b) => ({
              id: b.athlete?.id,
              name: b.athlete?.displayName || b.athlete?.name,
              runs: b.runs,
              balls: b.balls,
              headshot:
                b.athlete?.headshot?.href ||
                (b.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${b.athlete.id}.png` : null)
            }))
          }))
        });
      }

      if (ls.fow && ls.fow.length > 0) {
        inningsFow.push({
          team: teamName,
          period: innPeriod,
          score: innScore,
          overs: innOvers,
          fallOfWickets: ls.fow.map((f) => ({
            wicketNumber: f.wicketNumber,
            wicketOver: f.wicketOver,
            runs: f.runs,
            runsScored: f.runsScored,
            ballsFaced: f.ballsFaced,
            fowType: f.fowType,
            batsman: {
              id: f.athlete?.id,
              name: f.athlete?.displayName || f.athlete?.name,
              position: f.athlete?.position?.abbreviation,
              headshot:
                f.athlete?.headshot?.href ||
                (f.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${f.athlete.id}.png` : null)
            }
          }))
        });
      }

      if (ls.reviews) {
        drsReviews.push({
          team: teamName,
          period: innPeriod,
          reviews: ls.reviews
        });
      }
    }
  }

  const tossNote = (data.notes || []).find((n) => n.type === 'toss')?.text || '';
  if (tossNote) {
    summary.toss = tossNote;
    details['Toss'] = tossNote;
  }

  return {
    message: 'Match scorecard retrieved successfully',
    tableCount: tables.length,
    data: {
      summary,
      details,
      squads,
      tables,
      partnerships: inningsPartnerships,
      fallOfWickets: inningsFow,
      drsReviews,
      leaders: data.leaders || [],
      gameInfo: data.gameInfo || {},
      notes: data.notes || [],
      debuts: data.debuts || [],
      videos: data.videos || [],
      news: data.news?.articles || data.articles || (data.news ? (Array.isArray(data.news) ? data.news : [data.news]) : []),
      article: data.article || null,
      raw: data // Complete 100% unstripped underlying ESPN payload
    }
  };
}

const scoreCardController = {
  getScoreCard: async (req, res) => {
    let url = req.query.url;

    // Default to the first live or recent match if no URL is provided
    if (!url) {
      try {
        const headerRes = await fetch('https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket', {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (headerRes.ok) {
          const headerJson = await headerRes.json();
          const firstLeague = headerJson.sports?.[0]?.leagues?.[0];
          const firstEvent = firstLeague?.events?.[0];
          if (firstLeague?.id && firstEvent?.id) {
            url = `https://www.espn.in/cricket/series/${firstLeague.id}/game/${firstEvent.id}`;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!url) {
      try {
        const liveHtml = await fetchPageHtml('https://www.espncricinfo.com/live-cricket-score');
        if (liveHtml) {
          const $live = cheerio.load(liveHtml);
          const nextDataRaw = $live('script#__NEXT_DATA__').html();
          if (nextDataRaw) {
            try {
              const json = JSON.parse(nextDataRaw);
              const matches = json.props?.appPageProps?.data?.content?.matches;
              if (Array.isArray(matches) && matches.length > 0) {
                const m = matches[0];
                const seriesSlug = m.series?.slug;
                const matchSlug = m.slug;
                const id = m.objectId || m.id;
                if (seriesSlug && matchSlug && id) {
                  url = `https://www.espncricinfo.com/series/${seriesSlug}/${matchSlug}-${id}/full-scorecard`;
                }
              }
            } catch (jsonErr) {}
          }

          if (!url) {
            const firstMatchLink = $live('a[href*="/series/"][href*="live-cricket-score"], a[href*="/series/"][href*="scorecard"]').first().attr('href');
            if (firstMatchLink) {
              url = firstMatchLink.startsWith('http') ? firstMatchLink : `https://www.espncricinfo.com${firstMatchLink}`;
            }
          }
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
      if (!url.endsWith('/full-scorecard') && !url.includes('?') && !url.includes('/game/')) {
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

    // 1. Ultra-fast direct ESPN Summary API (< 300ms, immune to Akamai 403 on Vercel)
    const ids = extractIdsFromUrl(url);
    if (ids && ids.leagueId && ids.eventId) {
      try {
        const espnSummaryUrl = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${ids.leagueId}/summary?event=${ids.eventId}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const rawRes = await fetch(espnSummaryUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        clearTimeout(timer);
        if (rawRes.ok) {
          const rawJson = await rawRes.json();
          const [formatted, commentary] = await Promise.all([
            formatEspnScorecard(rawJson),
            fetchEspnCommentary(ids.leagueId, ids.eventId)
          ]);

          if (formatted && formatted.data && formatted.data.tables.length > 0) {
            formatted.data.commentary = commentary;
            const isCompleted =
              formatted.data.summary.status?.toLowerCase().includes('result') ||
              formatted.data.summary.status?.toLowerCase().includes('final');
            cacheService.set(cacheKey, formatted, isCompleted ? 30 * 60 * 1000 : 45 * 1000);
            return res.status(200).json(formatted);
          }
        }
      } catch (espnErr) {
        // Fall back to HTML scraping
      }
    }

    try {
      const html = await fetchPageHtml(url);
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

      // Check and parse script#__NEXT_DATA__ for rich squads, details, and raw data
      let nextDataJson = null;
      const nextDataRaw = $('script#__NEXT_DATA__').html();
      if (nextDataRaw) {
        try {
          nextDataJson = JSON.parse(nextDataRaw);
        } catch (e) {}
      }

      const content = nextDataJson?.props?.appPageProps?.data?.content || nextDataJson?.props?.pageProps?.data?.content;

      // Extract Squads from __NEXT_DATA__ matchPlayers
      const squads = {};
      if (content?.matchPlayers?.teamPlayers && Array.isArray(content.matchPlayers.teamPlayers)) {
        for (const tp of content.matchPlayers.teamPlayers) {
          const teamName = tp.team?.longName || tp.team?.name || 'Team';
          const players = (tp.players || []).map((p) => {
            const playerObj = p.player || {};
            const imgPath = playerObj.image?.url;
            const image = imgPath
              ? `https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50${imgPath}`
              : null;

            return {
              name: playerObj.name || playerObj.longName || 'Player',
              role: p.playerRoleType || playerObj.battingStyle || playerObj.bowlingStyle || 'Player',
              image,
              captain: p.isCaptain || false,
              wicketkeeper: p.isKeeper || false,
              id: playerObj.id || playerObj.objectId || null
            };
          });

          if (players.length > 0) {
            squads[teamName] = players;
          }
        }
      }

      // Fallback squads extraction from parsed scorecard tables if not present in matchPlayers
      if (Object.keys(squads).length === 0 && scorecardData.tables.length > 0) {
        for (const tbl of scorecardData.tables) {
          const teamNameMatch = tbl.title.replace(/\s+(Batting|Bowling|Innings.*)$/i, '').trim();
          const teamKey = teamNameMatch || 'Team';
          if (!squads[teamKey]) squads[teamKey] = [];

          const existingNames = new Set(squads[teamKey].map((p) => p.name));

          // Add players from rows
          for (const row of tbl.rows || []) {
            const pName = row['BATTING'] || row['Batting'] || row['BOWLING'] || row['Bowling'] || Object.values(row)[0] || '';
            const cleanName = pName.split('\n')[0].replace(/►/g, '').trim();
            if (cleanName && !existingNames.has(cleanName) && !cleanName.toLowerCase().includes('extras') && !cleanName.toLowerCase().includes('total')) {
              existingNames.add(cleanName);
              squads[teamKey].push({
                name: cleanName,
                role: tbl.type === 'Bowling' ? 'Bowler' : 'Batter',
                image: null,
                captain: cleanName.includes('(c)'),
                wicketkeeper: cleanName.includes('†') || cleanName.includes('(wk)')
              });
            }
          }

          // Add didNotBat players
          for (const dnb of tbl.didNotBat || []) {
            if (dnb && !existingNames.has(dnb)) {
              existingNames.add(dnb);
              squads[teamKey].push({
                name: dnb,
                role: 'Player',
                image: null,
                captain: dnb.includes('(c)'),
                wicketkeeper: dnb.includes('†') || dnb.includes('(wk)')
              });
            }
          }
        }
      }

      // Extract details (Match Info, Umpires, Toss, Venue)
      const details = {};
      if (venue) details['Venue'] = venue;
      if (result) details['Match Result'] = result;
      if (sportsEvent?.name) details['Match Title'] = sportsEvent.name;

      $('div.ds-text-tight-s, table.ds-w-full tr').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes('Toss') && !details['Toss']) {
          details['Toss'] = text.replace(/^Toss\s*/i, '').trim();
        }
        if (text.includes('Umpires') && !details['Umpires']) {
          details['Umpires'] = text.replace(/^Umpires\s*/i, '').trim();
        }
        if (text.includes('Match Referee') && !details['Match Referee']) {
          details['Match Referee'] = text.replace(/^Match Referee\s*/i, '').trim();
        }
        if (text.includes('TV Umpire') && !details['TV Umpire']) {
          details['TV Umpire'] = text.replace(/^TV Umpire\s*/i, '').trim();
        }
      });

      scorecardData.squads = squads;
      scorecardData.details = details;
      scorecardData.news = nextDataJson?.props?.appPageProps?.data?.article || nextDataJson?.props?.appPageProps?.data?.news || [];
      scorecardData.raw = nextDataJson || null;

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
  },

  getCommentary: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const period = req.query.period ? parseInt(req.query.period, 10) : null;

    const cacheKey = `commentary_${ids.leagueId}_${ids.eventId}_${limit}_${page}_${period || 'all'}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const commentary = await fetchEspnCommentary(ids.leagueId, ids.eventId, limit, page, period);
    cacheService.set(cacheKey, commentary, 30 * 1000); // 30s TTL
    return res.status(200).json(commentary);
  },

  getPartnerships: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `partnerships_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const raw = await fetchEspnSummaryRaw(ids.leagueId, ids.eventId);
    if (!raw) {
      return res.status(500).json({ error: 'Failed to retrieve match summary from ESPN' });
    }

    const competitors = raw.header?.competitions?.[0]?.competitors || [];
    const inningsPartnerships = [];

    for (const c of competitors) {
      const teamName = c.team?.displayName || c.team?.name || 'Team';
      for (const ls of c.linescores || []) {
        if (ls.partnerships && ls.partnerships.length > 0) {
          inningsPartnerships.push({
            team: teamName,
            period: ls.period || 1,
            score: `${ls.runs || 0}/${ls.wickets || 0}`,
            overs: ls.overs || '0',
            partnerships: ls.partnerships.map((p) => ({
              wicketNumber: p.wicketNumber,
              wicketName: p.wicketName,
              runs: p.runs,
              overs: p.overs,
              runRate: p.runRate,
              start: p.start,
              end: p.end,
              batsmen: (p.batsmen || []).map((b) => ({
                id: b.athlete?.id || null,
                name: b.athlete?.displayName || b.athlete?.name || 'Player',
                runs: b.runs,
                balls: b.balls,
                headshot:
                  b.athlete?.headshot?.href ||
                  (b.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${b.athlete.id}.png` : null)
              }))
            }))
          });
        }
      }
    }

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      matchTitle: raw.header?.description || raw.header?.name || 'Cricket Match',
      inningsCount: inningsPartnerships.length,
      innings: inningsPartnerships
    };

    cacheService.set(cacheKey, response, 45 * 1000);
    return res.status(200).json(response);
  },

  getFallOfWickets: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `fow_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const raw = await fetchEspnSummaryRaw(ids.leagueId, ids.eventId);
    if (!raw) {
      return res.status(500).json({ error: 'Failed to retrieve match summary from ESPN' });
    }

    const competitors = raw.header?.competitions?.[0]?.competitors || [];
    const inningsFow = [];

    for (const c of competitors) {
      const teamName = c.team?.displayName || c.team?.name || 'Team';
      for (const ls of c.linescores || []) {
        if (ls.fow && ls.fow.length > 0) {
          inningsFow.push({
            team: teamName,
            period: ls.period || 1,
            score: `${ls.runs || 0}/${ls.wickets || 0}`,
            overs: ls.overs || '0',
            fallOfWickets: ls.fow.map((f) => ({
              wicketNumber: f.wicketNumber,
              wicketOver: f.wicketOver,
              runs: f.runs,
              runsScored: f.runsScored,
              ballsFaced: f.ballsFaced,
              fowType: f.fowType,
              batsman: {
                id: f.athlete?.id || null,
                name: f.athlete?.displayName || f.athlete?.name || 'Player',
                position: f.athlete?.position?.abbreviation || '',
                headshot:
                  f.athlete?.headshot?.href ||
                  (f.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${f.athlete.id}.png` : null)
              }
            }))
          });
        }
      }
    }

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      matchTitle: raw.header?.description || raw.header?.name || 'Cricket Match',
      inningsCount: inningsFow.length,
      innings: inningsFow
    };

    cacheService.set(cacheKey, response, 45 * 1000);
    return res.status(200).json(response);
  },

  getDrsReviews: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `drs_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const raw = await fetchEspnSummaryRaw(ids.leagueId, ids.eventId);
    if (!raw) {
      return res.status(500).json({ error: 'Failed to retrieve match summary from ESPN' });
    }

    const competitors = raw.header?.competitions?.[0]?.competitors || [];
    const reviewsSummary = [];

    for (const c of competitors) {
      const teamName = c.team?.displayName || c.team?.name || 'Team';
      for (const ls of c.linescores || []) {
        if (ls.reviews) {
          reviewsSummary.push({
            team: teamName,
            period: ls.period || 1,
            reviews: ls.reviews
          });
        }
      }
    }

    const challenges = (raw.notes || [])
      .filter((n) => n.text && n.text.toLowerCase().includes('review by'))
      .map((n) => ({
        day: n.dayNumber || null,
        text: n.text,
        type: n.type || 'matchnote'
      }));

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      matchTitle: raw.header?.description || raw.header?.name || 'Cricket Match',
      reviewsSummary,
      challenges
    };

    cacheService.set(cacheKey, response, 45 * 1000);
    return res.status(200).json(response);
  },

  getSquads: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `squads_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const raw = await fetchEspnSummaryRaw(ids.leagueId, ids.eventId);
    if (!raw) {
      return res.status(500).json({ error: 'Failed to retrieve match summary from ESPN' });
    }

    const squads = {};
    for (const r of raw.rosters || []) {
      const teamName = r.team?.displayName || r.team?.name || 'Team';
      const teamLogo =
        r.team?.logos?.[0]?.href ||
        (r.team?.id ? `https://a.espncdn.com/i/teamlogos/cricket/500/${r.team.id}.png` : null);
      const starters = [];
      const bench = [];

      for (const p of r.roster || []) {
        const playerObj = {
          id: p.athlete?.id || null,
          name: p.athlete?.displayName || p.athlete?.name || 'Player',
          fullName: p.athlete?.fullName || '',
          position: p.athlete?.position?.name || p.position?.name || 'Player',
          positionAbbr: p.athlete?.position?.abbreviation || p.position?.abbreviation || '',
          captain: Boolean(p.captain),
          keeper: Boolean(p.keeper),
          starter: Boolean(p.starter),
          headshot:
            p.athlete?.headshot?.href ||
            (p.athlete?.id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${p.athlete.id}.png` : null)
        };

        if (p.starter) {
          starters.push(playerObj);
        } else {
          bench.push(playerObj);
        }
      }

      squads[teamName] = {
        team: {
          id: r.team?.id || null,
          name: teamName,
          logo: teamLogo
        },
        playingXI: starters,
        bench
      };
    }

    const debuts = (raw.debuts || []).map((d) => ({
      team: d.team?.displayName || d.team?.name,
      players: (d.roster || []).map((p) => p.athlete?.displayName || p.athlete?.name)
    }));

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      matchTitle: raw.header?.description || raw.header?.name || 'Cricket Match',
      squads,
      debuts
    };

    cacheService.set(cacheKey, response, 15 * 60 * 1000);
    return res.status(200).json(response);
  },

  getMatchInfo: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `match_info_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const raw = await fetchEspnSummaryRaw(ids.leagueId, ids.eventId);
    if (!raw) {
      return res.status(500).json({ error: 'Failed to retrieve match summary from ESPN' });
    }

    const gameInfo = raw.gameInfo || {};
    const venue = gameInfo.venue || {};
    const officials = (gameInfo.officials || []).map((o) => ({
      name: o.displayName,
      role: o.position?.name || 'Official',
      order: o.order,
      country: o.flag?.alt || ''
    }));

    const tossNote = (raw.notes || []).find((n) => n.type === 'toss')?.text || '';
    const matchDaysNote = (raw.notes || []).find((n) => n.type === 'matchdays')?.text || '';
    const hoursOfPlayNote = (raw.notes || []).find((n) => n.type === 'hoursofplay')?.text || '';
    const matchNumberNote = (raw.notes || []).find((n) => n.type === 'matchnumber')?.text || '';

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      matchTitle: raw.header?.description || raw.header?.name || 'Cricket Match',
      toss: tossNote,
      matchNumber: matchNumberNote,
      matchDays: matchDaysNote,
      hoursOfPlay: hoursOfPlayNote,
      venue: {
        id: venue.id,
        name: venue.fullName || venue.shortName || '',
        city: venue.address?.city || '',
        country: venue.address?.country || '',
        capacity: venue.capacity || null,
        grass: venue.grass !== undefined ? venue.grass : true,
        images: (venue.images || []).map((img) => img.href)
      },
      officials
    };

    cacheService.set(cacheKey, response, 15 * 60 * 1000);
    return res.status(200).json(response);
  },

  getMatchPreview: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `match_preview_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    // Commentary over 0.1 contains pitch report, captain quotes, and match setup in preText
    const commentary = await fetchEspnCommentary(ids.leagueId, ids.eventId, 5, 1, 1);
    const firstItem = commentary?.[0] || {};
    const preText = firstItem.preText || '';

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      previewHtml: preText,
      timestamp: firstItem.timestamp || null
    };

    cacheService.set(cacheKey, response, 30 * 60 * 1000);
    return res.status(200).json(response);
  },

  getManhattan: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `manhattan_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    // Fetch full match balls
    const commentary = await fetchEspnCommentary(ids.leagueId, ids.eventId, 300, 1);
    const inningsMap = {};

    for (const item of commentary) {
      const period = item.period || 'Innings 1';
      const overNum = item.over ? Math.floor(item.over) + 1 : 1;
      if (!inningsMap[period]) {
        inningsMap[period] = {
          period,
          team: item.team || '',
          oversMap: {}
        };
      }

      if (!inningsMap[period].oversMap[overNum]) {
        inningsMap[period].oversMap[overNum] = {
          over: overNum,
          runs: 0,
          wickets: 0,
          balls: 0,
          bowler: item.bowler || ''
        };
      }

      inningsMap[period].oversMap[overNum].runs += item.runs || 0;
      if (item.isWicket) {
        inningsMap[period].oversMap[overNum].wickets += 1;
      }
      inningsMap[period].oversMap[overNum].balls += 1;
      if (item.bowler) {
        inningsMap[period].oversMap[overNum].bowler = item.bowler;
      }
    }

    const innings = Object.values(inningsMap).map((inn) => {
      let cumulative = 0;
      const sortedOvers = Object.values(inn.oversMap)
        .sort((a, b) => a.over - b.over)
        .map((o) => {
          cumulative += o.runs;
          return {
            over: o.over,
            runs: o.runs,
            wickets: o.wickets,
            balls: o.balls,
            bowler: o.bowler,
            cumulativeRuns: cumulative
          };
        });

      return {
        period: inn.period,
        team: inn.team,
        totalOvers: sortedOvers.length,
        overs: sortedOvers
      };
    });

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      innings
    };

    cacheService.set(cacheKey, response, 45 * 1000);
    return res.status(200).json(response);
  },

  getWorm: async (req, res) => {
    const ids = await resolveMatchIds(req);
    if (!ids || !ids.leagueId || !ids.eventId) {
      return res.status(400).json({
        error: 'No match identified',
        message: 'Provide ?leagueId=...&eventId=... or ?url=...'
      });
    }

    const cacheKey = `worm_${ids.leagueId}_${ids.eventId}`;
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const commentary = await fetchEspnCommentary(ids.leagueId, ids.eventId, 300, 1);
    const inningsMap = {};

    for (const item of commentary) {
      const period = item.period || 'Innings 1';
      const overNum = item.over ? Math.floor(item.over) + 1 : 1;
      if (!inningsMap[period]) {
        inningsMap[period] = {
          period,
          team: item.team || '',
          oversMap: {}
        };
      }

      if (!inningsMap[period].oversMap[overNum]) {
        inningsMap[period].oversMap[overNum] = {
          over: overNum,
          runs: 0,
          wickets: 0
        };
      }

      inningsMap[period].oversMap[overNum].runs += item.runs || 0;
      if (item.isWicket) {
        inningsMap[period].oversMap[overNum].wickets += 1;
      }
    }

    const trajectories = Object.values(inningsMap).map((inn) => {
      let cumulative = 0;
      const points = [{ over: 0, score: 0, wickets: 0 }];
      const sorted = Object.values(inn.oversMap).sort((a, b) => a.over - b.over);
      let totalWickets = 0;

      for (const o of sorted) {
        cumulative += o.runs;
        totalWickets += o.wickets;
        points.push({
          over: o.over,
          score: cumulative,
          wickets: totalWickets
        });
      }

      return {
        period: inn.period,
        team: inn.team,
        trajectory: points
      };
    });

    const response = {
      leagueId: ids.leagueId,
      eventId: ids.eventId,
      trajectories
    };

    cacheService.set(cacheKey, response, 45 * 1000);
    return res.status(200).json(response);
  }
};

// Aliases for routing flexibility
scoreCardController.getScorecard = scoreCardController.getScoreCard;
scoreCardController.getFow = scoreCardController.getFallOfWickets;
scoreCardController.getDrs = scoreCardController.getDrsReviews;

module.exports = scoreCardController;
