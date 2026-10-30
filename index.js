const express = require('express');
const cors = require('cors');
const browserService = require('./services/browserService');
const cacheService = require('./services/cacheService');
const flagService = require('./services/flagService');

const PORT = process.env.PORT || 8000;
const app = express();

app.use(cors());
app.use(express.json());

// Backward compatibility globals if needed
global.getBrowser = browserService.getBrowser;
global.closeBrowser = browserService.closeBrowser;
global.getCachedData = (key) => cacheService.get(key);
global.setCachedData = (key, data, ttl) => cacheService.set(key, data, ttl);
global.flagService = flagService;

// Root endpoint with comprehensive documentation of all endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Cricket API Made by Abhip32!',
    status: 'online',
    version: '2.5.0',
    documentation: {
      liveMatches: {
        endpoint: '/getLive',
        method: 'GET',
        description: 'Returns real-time live cricket matches, current scores, overs, targets, series information, and dynamic team flags.',
        cacheTTL: '45 seconds',
        parameters: {
          league: 'Optional tournament/series ID filter (e.g. ?league=8048)',
          group: 'Optional group filter (e.g. ?group=international)',
          region: 'Optional region filter (e.g. ?region=in)',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      recentMatches: {
        endpoint: '/getRecent',
        method: 'GET',
        description: 'Returns recently completed cricket matches and match results across series with dynamic team flags.',
        cacheTTL: '5 minutes',
        parameters: {
          league: 'Optional tournament/series ID filter (e.g. ?league=8048)',
          group: 'Optional group filter (e.g. ?group=international)',
          region: 'Optional region filter (e.g. ?region=in)',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      upcomingMatches: {
        endpoint: '/getUpcoming',
        method: 'GET',
        description: 'Returns upcoming scheduled matches and fixtures powered directly by ESPN Cricinfo official API with dynamic team flags.',
        cacheTTL: '10 minutes',
        parameters: {
          date: 'Optional target date in YYYYMMDD format (e.g. ?date=20261101)',
          category: 'Optional category (international, domestic, league)',
          format: 'Optional format (TEST, ODI, T20)',
          league: 'Optional tournament ID filter',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      schedule: {
        endpoint: '/getSchedule',
        method: 'GET',
        description: 'Returns comprehensive tournament schedules, series fixtures, and match timings across international and domestic cricket.',
        cacheTTL: '10 minutes',
        parameters: {
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      activeSeries: {
        endpoint: '/getSeries',
        aliases: ['/series', '/getTournaments'],
        method: 'GET',
        description: 'Returns all currently active cricket tournaments and bilateral series with their league IDs, match counts, and live status.',
        cacheTTL: '10 minutes',
        parameters: {
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      tournamentStandings: {
        endpoint: '/getStandings',
        aliases: ['/standings', '/series/:leagueId/standings'],
        method: 'GET',
        description: 'Returns real-time tournament points table and standings with ranks, points, stats, and official 500x500 CDN team crests.',
        cacheTTL: '5 minutes',
        parameters: {
          leagueId: 'Tournament ID (e.g. ?leagueId=8043 for Sheffield Shield or ?leagueId=21284 for WBBL)',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      seriesTeams: {
        endpoint: '/getSeriesTeams',
        aliases: ['/series/:leagueId/teams'],
        method: 'GET',
        description: 'Returns all participating teams in a tournament or series with official high-res logos.',
        cacheTTL: '15 minutes',
        parameters: {
          leagueId: 'Tournament/series ID (e.g. ?leagueId=8043)'
        }
      },
      playerSearch: {
        endpoint: '/player/search',
        method: 'GET',
        description: 'Search for cricketers by name with player IDs, country affiliations, and official high-resolution player headshots.',
        cacheTTL: '15 minutes',
        parameters: {
          query: 'Player name search term (e.g. ?query=Kohli)',
          limit: 'Max results (1-25, default 10)'
        }
      },
      playerProfile: {
        endpoint: '/player/:id',
        aliases: ['/getPlayer?id=:id'],
        method: 'GET',
        description: 'Returns detailed player profile including DOB, age, playing roles, batting/bowling style, national team crest, and headshot image.',
        cacheTTL: '1 hour',
        parameters: {
          id: 'Numeric athlete ID (e.g. /player/253802 or ?id=253802 for Virat Kohli)'
        }
      },
      universalSearch: {
        endpoint: '/search',
        method: 'GET',
        description: 'Universal search across cricketers, international & franchise teams, series, news stories, and video clips.',
        cacheTTL: '10 minutes',
        parameters: {
          query: 'Search query (e.g. ?query=Australia or ?query=Mumbai+Indians)',
          type: 'Optional filter: player, team, league, series, article, clips',
          limit: 'Max results per group (default 10)'
        }
      },
      scorecard: {
        endpoint: '/getScorecard',
        aliases: ['/scorecard'],
        method: 'GET',
        description: 'Returns detailed full match scorecard including batting & bowling tables, innings breakdowns, partnerships, FOW, DRS reviews, Playing XI, and match details.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          url: 'Optional ESPN Cricinfo match scorecard URL. Defaults to the latest active match.',
          leagueId: 'Optional direct league ID (e.g. ?leagueId=24756&eventId=1553295)',
          eventId: 'Optional direct event ID',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      matchPartnerships: {
        endpoint: '/match/partnerships',
        aliases: ['/getPartnerships'],
        method: 'GET',
        description: 'Returns comprehensive wicket-by-wicket partnership breakdown for all innings with runs, overs, run rates, and individual player contributions with headshots.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          leagueId: 'Tournament ID (e.g. ?leagueId=24756&eventId=1553295)',
          eventId: 'Match event ID',
          url: 'Optional ESPN match URL'
        }
      },
      fallOfWickets: {
        endpoint: '/match/fow',
        aliases: ['/getFow'],
        method: 'GET',
        description: 'Returns official Fall of Wickets (FOW) timeline for each innings with exact overs, scores, dismissal types, and batter photos.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID',
          url: 'Optional ESPN match URL'
        }
      },
      drsReviews: {
        endpoint: '/match/drs',
        aliases: ['/getDrs'],
        method: 'GET',
        description: 'Returns Decision Review System (DRS) statistics (reviews permitted, remaining, successful, unsuccessful) and challenge logs.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID'
        }
      },
      matchSquads: {
        endpoint: '/match/squads',
        aliases: ['/getSquads'],
        method: 'GET',
        description: 'Returns Playing XI (starters), bench/substitutes, captains, wicketkeepers, debutants, and verified headshots for both teams.',
        cacheTTL: '15 minutes',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID'
        }
      },
      matchInfo: {
        endpoint: '/match/info',
        aliases: ['/getMatchInfo'],
        method: 'GET',
        description: 'Returns venue info (stadium name, city, country, capacity, grass surface), on-field umpires, TV umpire, match referee with nationality flags, and toss result.',
        cacheTTL: '15 minutes',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID'
        }
      },
      matchPreview: {
        endpoint: '/match/preview',
        aliases: ['/getMatchPreview'],
        method: 'GET',
        description: 'Returns pitch report, captain toss quotes, and tactical match build-up from expert commentators.',
        cacheTTL: '30 minutes',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID'
        }
      },
      manhattanChart: {
        endpoint: '/match/manhattan',
        aliases: ['/getManhattan'],
        method: 'GET',
        description: 'Returns over-by-over runs, wickets, and cumulative progression for each innings ready to plot a Manhattan bar chart.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID'
        }
      },
      wormChart: {
        endpoint: '/match/worm',
        aliases: ['/getWorm'],
        method: 'GET',
        description: 'Returns comparative cumulative run trajectories across overs for both innings to plot a Worm progression chart.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          leagueId: 'Tournament ID',
          eventId: 'Match event ID'
        }
      },
      commentary: {
        endpoint: '/getCommentary',
        aliases: ['/commentary'],
        method: 'GET',
        description: 'Returns real-time ball-by-ball commentary stream with over summaries, ball outcomes, bowler/batter matchups, and video highlight clips.',
        cacheTTL: '30 seconds',
        parameters: {
          url: 'Optional ESPN match URL',
          leagueId: 'Optional direct league ID',
          eventId: 'Optional direct event ID',
          limit: 'Number of balls to return (1-300, default 100)',
          page: 'Pagination index (e.g. ?page=2)',
          period: 'Innings filter (1, 2, 3, 4)'
        }
      },
      news: {
        endpoint: '/getNews',
        aliases: ['/news'],
        method: 'GET',
        description: 'Returns latest cricket news articles with titles, descriptions, dates, authors, high-res 900x506 images, and categories powered directly by ESPN.',
        cacheTTL: '10 minutes',
        parameters: {
          leagueId: 'Optional tournament filter (e.g. ?leagueId=8048 for IPL news, default "0" for global news)',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      photos: {
        endpoint: '/getPhotos',
        method: 'GET',
        description: 'Returns latest cricket photo galleries and high-resolution images sourced from Cricbuzz.',
        cacheTTL: '15 minutes',
        parameters: {
          id: 'Optional album ID (e.g. ?id=2405) to fetch high-resolution gallery images with captions',
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      teamRankings: {
        endpoint: '/rankings/icc-team-ranking',
        aliases: ['/getTeamRankings'],
        method: 'GET',
        description: 'Returns official ICC Men & Women team rankings across Test, ODI, and T20 formats with dynamic team logos.',
        cacheTTL: '1 hour',
        parameters: {
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      playerRankings: {
        endpoint: '/rankings/icc-player-ranking',
        aliases: ['/getBattingRankings', '/getBowlingRankings', '/getAllRounderRankings'],
        method: 'GET',
        description: 'Returns official ICC player rankings across batting, bowling, and all-rounders in Test, ODI, and T20 formats.',
        cacheTTL: '1 hour',
        parameters: {
          refresh: 'Optional boolean (?refresh=true) to bypass cache'
        }
      },
      teamFlags: {
        endpoint: '/team-flags',
        method: 'GET',
        description: 'Returns dynamically resolved cricket team logos and flags dictionary. Can also query a single team via ?team=India.',
        parameters: {
          team: 'Optional team name (e.g. ?team=India or ?team=NZ)'
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint to inspect fetch behavior on serverless
app.get('/diag', async (req, res) => {
  const url = req.query.url || 'https://www.espncricinfo.com/live-cricket-score';
  const ua = req.query.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
  const t0 = Date.now();
  try {
    const headers = { 'User-Agent': ua };
    if (req.query.accept) headers['Accept'] = req.query.accept;
    if (req.query.ref) headers['Referer'] = req.query.ref;

    const rawRes = await fetch(url, { headers });
    const duration = Date.now() - t0;
    const body = await rawRes.text();
    res.status(200).json({
      url,
      ua,
      status: rawRes.status,
      statusText: rawRes.statusText,
      headers: Object.fromEntries(rawRes.headers.entries()),
      durationMs: duration,
      bodyLength: body.length,
      bodyPreview: body.slice(0, 300),
      hasNextData: body.includes('__NEXT_DATA__')
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      durationMs: Date.now() - t0
    });
  }
});

// Dynamic Team Flags registry endpoint
app.get('/team-flags', (req, res) => {
  const teamQuery = req.query.team ? String(req.query.team).trim() : '';
  if (teamQuery) {
    const flag = flagService.getFlag(teamQuery);
    return res.status(200).json({
      team: teamQuery,
      flag
    });
  }
  return res.status(200).json(flagService.getAllFlags());
});

// Mount Standard & New Routes
app.use(require('./routes/newsRoute'));
app.use(require('./routes/MatchDataRoute'));
app.use(require('./routes/rankingRoutes'));
app.use(require('./routes/ScoreCardRoute'));
app.use(require('./routes/photoRoute'));
app.use(require('./routes/playerRoute'));
app.use(require('./routes/seriesRoute'));

// Frontend Compatibility Aliases
const matchController = require('./controller/MatchDataController');
const rankingController = require('./controller/rankingController');
const scoreCardController = require('./controller/scoreCardController');
const photoController = require('./controller/photoController');
const playerController = require('./controller/playerController');
const seriesController = require('./controller/seriesController');

app.get('/getScoreCard', scoreCardController.getScorecard);
app.get('/getCommentary', scoreCardController.getCommentary);
app.get('/getPhotos', photoController.getPhotos);
app.get('/getSchedule', matchController.getSchedule);
app.get('/getschdule', matchController.getSchedule);
app.get('/getTeamRankings', rankingController.getICCtables);
app.get('/getBattingRankings', rankingController.getPlayersTable);
app.get('/getBowlingRankings', rankingController.getPlayersTable);
app.get('/getAllRounderRankings', rankingController.getPlayersTable);

// New Aliases
app.get('/getPlayer', playerController.getPlayerById);
app.get('/getSeries', seriesController.getSeriesList);
app.get('/getTournaments', seriesController.getSeriesList);
app.get('/getStandings', seriesController.getStandings);
app.get('/getSeriesTeams', seriesController.getSeriesTeams);
app.get('/getPartnerships', scoreCardController.getPartnerships);
app.get('/getFow', scoreCardController.getFallOfWickets);
app.get('/getDrs', scoreCardController.getDrsReviews);
app.get('/getSquads', scoreCardController.getSquads);
app.get('/getMatchInfo', scoreCardController.getMatchInfo);
app.get('/getMatchPreview', scoreCardController.getMatchPreview);
app.get('/getManhattan', scoreCardController.getManhattan);
app.get('/getWorm', scoreCardController.getWorm);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.url}. Visit / for available endpoints.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`Server listening on port :${PORT}`);
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await browserService.closeBrowser();
  server.close(() => {
    console.log('Server closed successfully.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
