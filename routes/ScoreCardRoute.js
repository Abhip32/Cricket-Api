const express = require('express');
const router = express.Router();
const scoreCardController = require('../controller/scoreCardController');

// Scorecard & Commentary
router.get('/getScorecard', scoreCardController.getScorecard);
router.get('/scorecard', scoreCardController.getScorecard);
router.get('/getCommentary', scoreCardController.getCommentary);
router.get('/commentary', scoreCardController.getCommentary);

// Match Analytics & Details
router.get('/match/partnerships', scoreCardController.getPartnerships);
router.get('/getPartnerships', scoreCardController.getPartnerships);

router.get('/match/fow', scoreCardController.getFallOfWickets);
router.get('/getFow', scoreCardController.getFallOfWickets);

router.get('/match/drs', scoreCardController.getDrsReviews);
router.get('/getDrs', scoreCardController.getDrsReviews);

router.get('/match/squads', scoreCardController.getSquads);
router.get('/getSquads', scoreCardController.getSquads);

router.get('/match/info', scoreCardController.getMatchInfo);
router.get('/getMatchInfo', scoreCardController.getMatchInfo);

router.get('/match/preview', scoreCardController.getMatchPreview);
router.get('/getMatchPreview', scoreCardController.getMatchPreview);

router.get('/match/manhattan', scoreCardController.getManhattan);
router.get('/getManhattan', scoreCardController.getManhattan);

router.get('/match/worm', scoreCardController.getWorm);
router.get('/getWorm', scoreCardController.getWorm);

router.get('/match/situation', scoreCardController.getSituation);
router.get('/getSituation', scoreCardController.getSituation);

router.get('/match/overs', scoreCardController.getOvers);
router.get('/getOvers', scoreCardController.getOvers);

// Match Timeline & Notes (50s, 100s, Partnerships, Sessions, DRS Reviews)
router.get('/match/timeline', scoreCardController.getTimeline);
router.get('/getTimeline', scoreCardController.getTimeline);
router.get('/match/notes', scoreCardController.getTimeline);

// Match Leaders & MVPs (Top batters, bowlers with headshots)
router.get('/match/leaders', scoreCardController.getLeaders);
router.get('/getLeaders', scoreCardController.getLeaders);

// Stadium Profile & Photos
router.get('/match/venue', scoreCardController.getVenue);
router.get('/getVenue', scoreCardController.getVenue);

// Live Ground Weather & Rain Probability
router.get('/match/weather', scoreCardController.getWeather);
router.get('/getWeather', scoreCardController.getWeather);

// Match Debuts Tracker
router.get('/match/debuts', scoreCardController.getDebuts);
router.get('/getDebuts', scoreCardController.getDebuts);

// Head-to-Head (H2H) Historical Rivalry
router.get('/match/h2h', scoreCardController.getH2H);
router.get('/getH2h', scoreCardController.getH2H);
router.get('/getH2H', scoreCardController.getH2H);

module.exports = router;
