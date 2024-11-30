const { getBrowser } = require('../utils/browserManager');
const { setupPage } = require('../utils/puppeteerHelper');
const { autoScroll } = require('../utils/scrollHelper');

const MatchDataController = {
  getLiveMatches: async (req, res) => {
    try {
      const browser = await getBrowser();
      const page = await setupPage(browser, 'https://www.espncricinfo.com/live-cricket-score');
      
      // Scroll to load all content
      await autoScroll(page);
      
      // Rest of the getLiveMatches code...
    } catch (error) {
      // Error handling...
    }
  },

  getRecentMatches: async (req, res) => {
    try {
      const browser = await getBrowser();
      const page = await setupPage(browser, 'https://www.espncricinfo.com/live-cricket-match-results');
      
      // Rest of the getRecentMatches code...
    } catch (error) {
      // Error handling...
    }
  },

  getUpcomingMatches: async (req, res) => {
    try {
      const browser = await getBrowser();
      const page = await setupPage(browser, 'https://www.espncricinfo.com/live-cricket-match-schedule-fixtures');
      
      // Rest of the getUpcomingMatches code...
    } catch (error) {
      // Error handling...
    }
  }
};

module.exports = MatchDataController;