const router = require('express').Router()
const newsController = require('../controller/newsController')

router.get('/getNewsS',newsController.getNewsS)
router.get('/getVideos',newsController.getVideos)
router.get('/getNews',newsController.getNews)
router.get('/getNewsPlus',newsController.getNewsPlus)
router.get('/getInterviews',newsController.getInterviews)
router.get('/getOpinions',newsController.getOpinions)
router.get('/getSpecials',newsController.getSpecials)
router.get('/getSpotlights',newsController.getSpotlight)
router.get('/getStats',newsController.getStats)

router.get('/player/:name',newsController.getPlayer)


module.exports = router