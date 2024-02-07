const router = require('express').Router()
const rankingController = require('../controller/rankingController')

router.get('/getBattingRankings',rankingController.getBattingRankings)
router.get('/getBowlingRankings',rankingController.getBowlingRankings)
router.get('/getAllRounderRankings',rankingController.getAllrounderRankings)
router.get('/getTeamRankings',rankingController.getTeamsRankings)

module.exports = router