const express = require('express');
const router = express.Router();
const seriesController = require('../controller/seriesController');

// Active Tournaments & Series: /getSeries, /series, /getTournaments
router.get('/getSeries', seriesController.getSeriesList);
router.get('/series', seriesController.getSeriesList);
router.get('/getTournaments', seriesController.getSeriesList);

// Tournament Standings / Points Table: /getStandings, /standings, /series/:leagueId/standings
router.get('/getStandings', seriesController.getStandings);
router.get('/standings', seriesController.getStandings);
router.get('/series/:leagueId/standings', seriesController.getStandings);

// Tournament Teams: /getSeriesTeams, /series/:leagueId/teams
router.get('/getSeriesTeams', seriesController.getSeriesTeams);
router.get('/series/:leagueId/teams', seriesController.getSeriesTeams);

module.exports = router;
