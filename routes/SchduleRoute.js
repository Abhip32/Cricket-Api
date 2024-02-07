const router = require('express').Router()
const scheduleConroller=require('../controller/SchduleController')

router.get('/getSchdule',scheduleConroller.getSchedule)


module.exports = router