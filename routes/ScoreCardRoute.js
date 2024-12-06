const express = require('express');
const router = express.Router();
const scoreCardController = require('../controller/scoreCardController');

router.get('/getScorecard', scoreCardController.getScoreCard);
router.get('/getSquads', scoreCardController.getSquads);
router.get('/getCommentary', scoreCardController.getCommentary);
router.get('/getMatchNews', scoreCardController.getNews);
router.get('/getMiniScorecard', scoreCardController.getMiniScorecard);

module.exports = router; 