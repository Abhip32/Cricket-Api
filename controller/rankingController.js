const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Helper to auto-scroll the page to load lazy content
const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

const rankingsController = {
  getICCtables: async (req, res) => {
    let page;
    try {
      const browser = global.getBrowser();
      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // Replace with your ICC rankings page
      await page.goto('https://espncricinfo.com/rankings/icc-team-ranking', {
        waitUntil: 'networkidle2',
        timeout: 0
      });

      await autoScroll(page);

      const html = await page.content();
      const $ = cheerio.load(html);

      const tablesData = [];

      $('.ds-w-full.ds-bg-fill-content-prime').each((i, tableBlock) => {
        const tableTitle = $(tableBlock).find('h2').first().text().trim();
        const lastUpdated = $(tableBlock).find('span.ds-text-tight-s').first().text().trim();

        const tableRows = [];

        $(tableBlock).find('tbody tr').each((j, row) => {
          const tds = $(row).find('td');

          const pos = $(tds[0]).text().trim();
          const teamName = $(tds[1]).find('span.ds-text-tight-s').text().trim();
          const teamLink = $(tds[1]).find('a').attr('href')
            ? `https://www.espncricinfo.com${$(tds[1]).find('a').attr('href')}`
            : null;
          const teamLogo = $(tds[1]).find('img').attr('src') || null;
          const matches = $(tds[2]).text().trim();
          const points = $(tds[3]).text().trim();
          const rating = $(tds[4]).text().trim();

          tableRows.push({
            pos,
            teamName,
            teamLink,
            teamLogo,
            matches,
            points,
            rating
          });
        });

        tablesData.push({
          tableTitle,
          lastUpdated,
          teams: tableRows
        });
      });

      res.status(200).json(tablesData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to scrape ICC tables' });
    } finally {
      if (page) await page.close();
    }
  },
   getPlayersTable: async (req, res) => {
    let page;
    try {
      const browser = global.getBrowser();
      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // Replace with your ICC player rankings page
      await page.goto(
        'https://www.espncricinfo.com/rankings/icc-player-ranking',
        { waitUntil: 'networkidle2', timeout: 0 }
      );

      await autoScroll(page);

      const html = await page.content();
      const $ = cheerio.load(html);

      const tablesData = [];

      // Select all player rankings tables
      $('.ds-w-full.ds-bg-fill-content-prime').each((i, tableBlock) => {
        const tableTitle = $(tableBlock).find('h2').first().text().trim();

        const tableRows = [];

        $(tableBlock).find('tbody tr').each((j, row) => {
          const tds = $(row).find('td');

          const rank = $(tds[0]).text().trim();
          const playerName = $(tds[1]).find('span.ds-text-tight-s').text().trim();
          const playerLink = $(tds[1]).find('a').attr('href')
            ? `https://www.espncricinfo.com${$(tds[1]).find('a').attr('href')}`
            : null;
          const country = $(tds[2]).text().trim();
          const rating = $(tds[3]).find('span.ds-text-tight-s').text().trim();

          tableRows.push({
            rank,
            playerName,
            playerLink,
            country,
            rating
          });
        });

        tablesData.push({
          tableTitle,
          players: tableRows
        });
      });

      res.status(200).json(tablesData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to scrape player rankings' });
    } finally {
      if (page) await page.close();
    }
  }
};

module.exports = rankingsController;
