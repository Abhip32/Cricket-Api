const router = require('express').Router();
const PhotoController = require('../controller/photoController');

router.get('/getPhotos', PhotoController.getPhotos);
router.get('/getPhotoGallery', PhotoController.getPhotos);

module.exports = router;
