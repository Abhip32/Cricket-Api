const express = require('express');
const router = express.Router();
const scoreCardController = require('../controller/scoreCardController');

router.get('/getScorecard', scoreCardController.getScorecard);
router.get('/getCommentary', scoreCardController.getCommentary);

module.exports = router; 