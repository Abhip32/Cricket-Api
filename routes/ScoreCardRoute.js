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

module.exports = router;
