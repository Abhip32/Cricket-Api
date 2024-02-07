const router = require('express').Router()
const featuresController = require('../controller/featuresController');

router.get('/onThisDay',featuresController.onThisDay);
router.get('/newsICC',featuresController.ICCnews);
router.get('/stats_facts',featuresController.Stats_Facts);
router.get('/POTW',featuresController.POTM);


module.exports = router