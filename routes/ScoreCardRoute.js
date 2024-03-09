const router = require('express').Router()
const scoreCardController=require('../controller/scoreCardController');

router.get('/getScorecard/:init/:id/:type/:match',scoreCardController.getScoreCard)

module.exports = router