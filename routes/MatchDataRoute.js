const router = require('express').Router()
const MatchDataConroller=require('../controller/MatchDataController')

router.get('/getLive',MatchDataConroller.getLiveMatches)
router.get('/getRecent',MatchDataConroller.getRecentMatches)
router.get('/getUpcoming',MatchDataConroller.getUpcomingMatches)

module.exports = router