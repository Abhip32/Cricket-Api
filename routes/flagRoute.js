const router = require('express').Router()
const flagController = require('../controller/flagController')

router.get('/getTeamFlag/:flag',flagController.getFlag)

module.exports = router