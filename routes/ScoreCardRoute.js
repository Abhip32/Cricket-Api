const router = require('express').Router()
const scoreCardController=require('../controller/scoreCardController');

router.get('/getScorecard',scoreCardController.getScoreCard)

module.exports = router