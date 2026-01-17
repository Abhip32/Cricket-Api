const router = require('express').Router()
const newsController = require('../controller/newsController')


router.get('/getNews',newsController.getNews)



module.exports = router