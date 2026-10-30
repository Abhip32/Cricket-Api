const express = require('express');
const router = express.Router();
const playerController = require('../controller/playerController');

// Player Search: /player/search?query=Kohli
router.get('/player/search', playerController.searchPlayers);

// Player Profile: /player/:id or /getPlayer?id=253802
router.get('/player/:id', playerController.getPlayerById);
router.get('/getPlayer', playerController.getPlayerById);

// Universal Search: /search?query=Australia
router.get('/search', playerController.universalSearch);

module.exports = router;
