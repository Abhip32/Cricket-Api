const router = require('express').Router()
const rankingController = require('../controller/rankingController')

router.get('/rankings/icc-team-ranking',rankingController.getICCtables)
router.get('/rankings/icc-player-ranking',rankingController.getPlayersTable)

module.exports = router