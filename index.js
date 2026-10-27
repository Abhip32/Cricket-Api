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
    version: '2.0.0',
    documentation: {
      liveMatches: {
        endpoint: '/getLive',
        method: 'GET',
        description: 'Returns real-time live cricket matches, current scores, overs, targets, series information, and dynamic team flags.',
        cacheTTL: '45 seconds',
        parameters: {
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
        }
      },
      recentMatches: {
        endpoint: '/getRecent',
        method: 'GET',
        description: 'Returns recently completed cricket matches and match results across series with dynamic team flags.',
        cacheTTL: '5 minutes',
        parameters: {
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
        }
      },
      upcomingMatches: {
        endpoint: '/getUpcoming',
        method: 'GET',
        description: 'Returns upcoming scheduled matches, fixtures, and dynamic team details with flags.',
        cacheTTL: '10 minutes',
        parameters: {
          date: 'Optional date filter in DD-MM-YYYY or YYYY-MM-DD (e.g. ?date=25-10-2026)',
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
        }
      },
      news: {
        endpoint: '/getNews',
        method: 'GET',
        description: 'Returns latest cricket news articles with titles, descriptions, dates, authors, and images.',
        cacheTTL: '10 minutes',
        parameters: {
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
        }
      },
      teamRankings: {
        endpoint: '/rankings/icc-team-ranking',
        method: 'GET',
        description: 'Returns official ICC Men & Women team rankings across Test, ODI, and T20 formats with dynamic team logos.',
        cacheTTL: '1 hour',
        parameters: {
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
        }
      },
      playerRankings: {
        endpoint: '/rankings/icc-player-ranking',
        method: 'GET',
        description: 'Returns official ICC player rankings across batting, bowling, and all-rounders in Test, ODI, and T20 formats.',
        cacheTTL: '1 hour',
        parameters: {
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
        }
      },
      scorecard: {
        endpoint: '/getScorecard',
        method: 'GET',
        description: 'Returns detailed full match scorecard including batting & bowling tables, innings breakdowns, dynamic team logos, and summary.',
        cacheTTL: '45 seconds (live) / 30 minutes (completed)',
        parameters: {
          url: 'Optional ESPN Cricinfo match scorecard URL. Defaults to the latest active match.',
          refresh: 'Optional boolean (e.g. ?refresh=true) to bypass cache'
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
    const headers = {
      'User-Agent': ua
    };
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

// Mount Standard Routes
app.use(require('./routes/newsRoute'));
app.use(require('./routes/MatchDataRoute'));
app.use(require('./routes/rankingRoutes'));
app.use(require('./routes/ScoreCardRoute'));

// Frontend Compatibility Aliases
const matchController = require('./controller/MatchDataController');
const rankingController = require('./controller/rankingController');
const scoreCardController = require('./controller/scoreCardController');

app.get('/getScoreCard', scoreCardController.getScorecard);
app.get('/getCommentary', scoreCardController.getCommentary);
app.get('/getSchedule', matchController.getSchedule);
app.get('/getschdule', matchController.getSchedule);
app.get('/getTeamRankings', rankingController.getICCtables);
app.get('/getBattingRankings', rankingController.getPlayersTable);
app.get('/getBowlingRankings', rankingController.getPlayersTable);
app.get('/getAllRounderRankings', rankingController.getPlayersTable);

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
