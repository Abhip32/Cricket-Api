const express = require('express');
const router = express.Router();
const newsController = require('../controller/newsController');

router.get('/getNews', newsController.getNews);
router.get('/news', newsController.getNews);

module.exports = router;
