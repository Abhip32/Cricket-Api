const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');
const flagService = require('../services/flagService');

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

function formatEspnScorecard(data) {
  if (!data || !data.header) return null;

  const comp = data.header.competitions?.[0] || {};
  const statusType = comp.status?.type || {};
  const competitors = comp.competitors || [];
  const rosters = data.rosters || [];

  const summary = {
    matchTitle: data.header.description || data.header.name || 'Match Scorecard',
    status: statusType.description || 'Live',
    result: statusType.detail || comp.statusText || '',
    venue: data.gameInfo?.venue?.fullName || '',
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

  return {
    message: 'Match scorecard retrieved successfully',
    tableCount: tables.length,
    data: {
      summary,
      details,
      squads,
      tables,
      leaders: data.leaders || [],
      gameInfo: data.gameInfo || {},
      notes: data.notes || [],
      debuts: data.debuts || [],
      videos: data.videos || [],
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
          const formatted = formatEspnScorecard(rawJson);
          if (formatted && formatted.data && formatted.data.tables.length > 0) {
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
