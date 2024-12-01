const axios = require('axios');
const cheerio = require('cheerio');
const { getBrowser } = require('../utils/browserManager');

const MatchDataController = {
  getLiveMatches: async (req, res) => {
    try {
      const browser = await getBrowser();
      const page = await browser.newPage();

      // Block unnecessary resources except images and scripts
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Navigate to the page and wait for it to fully load
      await page.goto('https://www.espncricinfo.com/live-cricket-score', {
        waitUntil: 'networkidle2',
        timeout: 0
      });

      // Scroll to load all content
      await autoScroll(page);

      // Get page content after scrolling
      const content = await page.content();
      const $ = cheerio.load(content);

      const matches = [];
      $('.ds-border-b.ds-border-line').each((i, element) => {
        const statusElement = $(element).find('.ds-text-tight-xs.ds-font-bold');
        const timingElement = $(element).find('.ds-text-tight-xs.ds-font-medium.ds-text-typo');
        const seriesElement = $(element).find('a[href*="/series/"] .ds-text-tight-xs.ds-text-typo');
        const venueElement = $(element).find('.ds-text-tight-xs.ds-truncate.ds-text-typo-mid3');

        const teams = [];
        $(element).find('.ci-team-score').each((j, team) => {
          const imgElement = $(team).find('img');
          const scoreElement = $(team).find('.ds-text-compact-s');

          let fullScore = '';
          const scoreNodes = scoreElement.find('strong');
          if (scoreNodes.length) {
            fullScore = scoreNodes
              .map((k, node) => $(node).text().trim())
              .get()
              .join(' & ')
              .replace(/\s+/g, ' ');
          }

          teams.push({
            name: $(team).find('.ds-text-tight-m.ds-font-bold').text().trim(),
            flag: imgElement.attr('src')?.replace('f_auto,t_ds_square_w_160,q_50/', ''),
            score: fullScore,
            isPlaying: $(team).find('.icon-dot_circular').length > 0
          });
        });

        const links = [];
        $(element).find('.ds-flex.ds-mx-4 a').each((j, link) => {
          links.push({
            text: $(link).text().trim(),
            url: 'https://www.espncricinfo.com' + $(link).attr('href')
          });
        });

        matches.push({
          status: {
            text: statusElement.text().trim() || '',
            timing: timingElement.text().trim() || ''
          },
          series: {
            name: seriesElement.text().trim(),
            details: venueElement.text().trim()
          },
          teams,
          result: $(element).find('.ds-text-tight-s.ds-font-medium').text().trim(),
          links,
          matchUrl: 'https://www.espncricinfo.com' + $(element).find('a').first().attr('href')
        });
      });

      // Don't close the browser, just close the page
      await page.close();

      // Filter out matches with incomplete data
      const validMatches = matches.filter(match =>
        match.teams.every(team =>
          team.flag && !team.flag.includes('lazyimage-transparent')
        ) && match.links.length > 0
      );

      res.status(200).json(validMatches);

    } catch (error) {
      console.error('Error fetching live scores:', error);
      res.status(500).json({ error: 'Failed to fetch live scores' });
    }
  },

  getRecentMatches : async (req, res) => {
    try {
      const browser = await getBrowser();
      const page = await browser.newPage();
      // Block unnecessary resources except images
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });
      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.goto('https://www.espncricinfo.com/live-cricket-match-results', {
        waitUntil: 'networkidle2',
        timeout: 0
      });

      // Scroll to load all content
      await autoScroll(page);
      // Wait for images to load
      await page.waitForSelector('img[src*="hscicdn"]', { timeout: 5000 }).catch(() => { });
      const matches = await page.evaluate(() => {
        const matchElements = document.querySelectorAll('.ds-border-b.ds-border-line');
        return Array.from(matchElements).map(element => {
          const statusElement = element.querySelector('.ds-text-tight-xs.ds-font-bold');
          const timingElement = element.querySelector('.ds-text-tight-xs.ds-font-medium.ds-text-typo');
          const seriesElement = element.querySelector('a[href*="/series/"] .ds-text-tight-xs.ds-text-typo');
          const venueElement = element.querySelector('.ds-text-tight-xs.ds-truncate.ds-text-typo-mid3');
          // Enhanced team details extraction
          const teamElements = element.querySelectorAll('.ci-team-score');
          const teams = Array.from(teamElements).map(team => {
            const imgElement = team.querySelector('img');
            const scoreElement = team.querySelector('.ds-text-compact-s');
            // Improved score extraction
            let fullScore = '';
            const scoreNodes = scoreElement?.querySelectorAll('strong');
            if (scoreNodes?.length) {
              fullScore = Array.from(scoreNodes)
                .map(node => node.textContent.trim())
                .join(' & ')
                .replace(/\s+/g, ' ');
            }
            return {
              name: team.querySelector('.ds-text-tight-m.ds-font-bold')?.textContent.trim(),
              flag: imgElement?.getAttribute('src')?.replace('f_auto,t_ds_square_w_160,q_50/', ''),
              score: fullScore,
              isPlaying: team.querySelector('.icon-dot_circular') !== null
            };

          });

          const resultElement = element.querySelector('.ds-text-tight-s.ds-font-medium');
          const links = Array.from(element.querySelectorAll('.ds-flex.ds-mx-4 a')).map(link => ({
            text: link.textContent.trim(),
            url: 'https://www.espncricinfo.com' + link.getAttribute('href')
          }));
          return {
            status: {
              text: statusElement?.textContent.trim() || '',
              timing: timingElement?.textContent.trim() || ''
            },

            series: {
              name: seriesElement?.textContent.trim(),
              details: venueElement?.textContent.trim()
            },
            teams,
            result: resultElement?.textContent.trim(),
            links,
            matchUrl: 'https://www.espncricinfo.com' + element.querySelector('a')?.getAttribute('href')
          };
        });
      });
      // Don't close the browser, just close the page
      await page.close();
      // Filter out matches with incomplete data
      const validMatches = matches.filter(match =>
        match.teams.every(team =>
          team.flag && !team.flag.includes('lazyimage-transparent')
        ) && match.links.length > 0
      );


      res.status(200).json(validMatches);

    } catch (error) {
      console.error('Error fetching live scores:', error);
      res.status(500).json({ error: 'Failed to fetch live scores' });

    }
  },

  getUpcomingMatches: async (req, res) => {
    try {
      const response = await axios.get('https://www.espncricinfo.com/live-cricket-match-schedule-fixtures', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const matches = [];
      
      // Find the date headers and their associated matches
      $('.ds-mb-6').each((_, dateGroup) => {
        const $dateGroup = $(dateGroup);
        const date = $dateGroup.find('.ds-text-tight-s.ds-font-medium').text().trim();
        
        $dateGroup.find('.ds-border.ds-border-line .ds-border-b.ds-border-line').each((_, element) => {
          const $match = $(element);
          
          // Extract match details
          const time = $match.find('.ds-text-compact-xs.ds-font-bold').first().text().trim();
          const gmtTime = $match.find('.ds-text-compact-xxs.ds-text-typo-mid3 span').first().text().trim();
          const localTime = $match.find('.ds-text-compact-xxs.ds-text-typo-mid3 span').last().text().trim();
          
          const title = $match.find('.ds-text-compact-s.ds-font-bold').text().trim();
          const details = $match.find('.ds-text-tight-xs.ds-text-typo-mid3').text().trim();
          const series = $match.find('a[href*="/series/"] .ds-text-tight-s.ds-font-medium').text().trim();
          
          // Check if match is international
          const isInternational = $match.find('.ds-text-tight-xxs.ds-font-bold.ds-align-middle').length > 0;
          
          // Get match URL
          const matchUrl = 'https://www.espncricinfo.com' + $match.find('a').first().attr('href');
          
          // Only include upcoming matches (filter out live and completed matches)
          if (!$match.find('.ds-text-tight-s.ds-font-medium').length) {
            matches.push({
              date,
              time,
              timings: {
                gmt: gmtTime,
                local: localTime
              },
              title,
              details,
              series,
              isInternational,
              matchUrl,
              coverage: $match.find('.ds-text-compact-xxs.ds-font-medium').text().trim()
            });
          }
        });
      });

      res.status(200).json(matches);
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming matches' });
    }
  },


};

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 2000;  // Increased from 1000 but not too aggressive
      const maxScrolls = 10;  // Limit maximum scrolls
      let scrollCount = 0;
      
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        // Stop if we've scrolled enough times or reached the bottom
        if (scrollCount >= maxScrolls || 
            totalHeight >= document.documentElement.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200); // Increased delay to ensure content loads
    });
  });
}




module.exports = MatchDataController;
