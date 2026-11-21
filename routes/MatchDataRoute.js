const router = require('express').Router();
const MatchDataConroller = require('../controller/MatchDataController');

router.get('/getLive', MatchDataConroller.getLiveMatches);
router.get('/getRecent', MatchDataConroller.getRecentMatches);
router.get('/getUpcoming', MatchDataConroller.getUpcomingMatches);
router.get('/getSchedule', MatchDataConroller.getSchedule);
router.get('/getTicker', MatchDataConroller.getTicker);
router.get('/match/ticker', MatchDataConroller.getTicker);

module.exports = router;
