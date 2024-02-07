const router = require('express').Router()
const scoreCardController=require('../controller/scoreCardController');

router.get('/getScorecard/:url/:tour/:match/:scorecard/:id',scoreCardController.getScoreCard)

module.exports = router