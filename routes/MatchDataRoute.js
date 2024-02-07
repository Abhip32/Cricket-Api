const router = require('express').Router()
const MatchDataConroller=require('../controller/MatchDataController')

router.get('/getLive',MatchDataConroller.getLiveMatches)

module.exports = router