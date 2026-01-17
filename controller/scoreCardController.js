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
const scoreCardController = {
getScorecard: async (req, res) => {
    let page;
    try {
      const browser = global.getBrowser();
      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // Example URL; replace with dynamic URL if needed (e.g., from req.query.url)
      const url = req.query.url || 'https://www.espncricinfo.com/series/women-s-premier-league-2025-26-1510059/mumbai-indians-women-vs-delhi-capitals-women-3rd-match-1513684/full-scorecard';
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 0
      });

      await autoScroll(page);

      const html = await page.content();
      const $ = cheerio.load(html);

      const scorecardData = {
        tables: []
      };

      // Scrape all scorecard tables with their titles
      $('.ds-w-full.ds-bg-fill-content-prime').each((tableIndex, tableContainer) => {
        const tableTitle = $(tableContainer).find('span.ds-text-title-xs.ds-font-bold.ds-capitalize').first().text().trim();

        if (tableTitle) {
          // Find ALL tables within this container (batting and bowling tables)
          const tables = $(tableContainer).find('.ds-w-full.ds-table.ds-table-xs.ds-table-auto');

          tables.each((tableIdx, table) => {
            const $table = $(table);
            const headers = [];

            // Get table headers
            $table.find('thead th').each((i, th) => {
              // Skip hidden columns
              if (!$(th).hasClass('ds-hidden')) {
                headers.push($(th).text().trim());
              }
            });

            const rows = [];

            // Get table rows
            $table.find('tbody tr').each((i, row) => {
              const $row = $(row);

              // Skip dismissal details, hidden rows, and separator rows
              if ($row.hasClass('ds-table-row-compact-top') ||
                  $row.hasClass('ds-hidden') ||
                  $row.find('td[colspan]').length > 0) {
                return;
              }

              // For batting tables, also skip rows that don't have player data
              const isBattingTable = headers[0]?.toLowerCase().includes('batting') ||
                                   headers[0]?.toLowerCase().includes('batsmen') ||
                                   $table.hasClass('ci-scorecard-table');

              const tds = $row.find('td').filter((_, td) => !$(td).hasClass('ds-hidden'));
              const rowData = {};

              if (isBattingTable) {
                // For batting table, be more lenient with empty cells
                tds.each((j, td) => {
                  const header = headers[j] || `col_${j}`;
                  const cellText = $(td).text().trim();
                  // Include empty cells for batting tables (they might be meaningful)
                  rowData[header] = cellText || '';
                });
              } else {
                // For bowling table, skip truly empty cells
                tds.each((j, td) => {
                  const header = headers[j] || `col_${j}`;
                  const cellText = $(td).text().trim();
                  if (cellText) {
                    rowData[header] = cellText;
                  }
                });
              }

              // For batting tables, include rows even if they have empty cells
              // For bowling tables, only include rows with data
              if (isBattingTable || Object.keys(rowData).length > 0) {
                rows.push(rowData);
              }
            });

            // Determine table type based on headers or table class
            const firstHeader = headers[0]?.toLowerCase() || '';
            const hasScorecardClass = $table.hasClass('ci-scorecard-table');
            let tableType = 'Unknown';

            if (firstHeader.includes('batting') || firstHeader.includes('batsmen') || hasScorecardClass) {
              tableType = 'Batting';
            } else if (firstHeader.includes('bowling')) {
              tableType = 'Bowling';
            }

            scorecardData.tables.push({
              title: tableTitle,
              type: tableType,
              headers: headers,
              rows: rows
            });
          });
        }
      });

      // Scrape Summary/Result
      const summaryDiv = $('.ds-text-compact-xxs.ds-p-2.ds-px-4.lg\\:ds-py-3');
      if (summaryDiv.length) {
        const result = summaryDiv.find('.ds-text-tight-s.ds-font-medium').text().trim();
        const venue= summaryDiv.find('.ds-text-tight-xs.ds-truncate.ds-text-typo-mid3.ds-mb-1').text().trim();
        const teams = [];
        summaryDiv.find('.ci-team-score').each((i, teamDiv) => {
          const teamName = $(teamDiv).find('a').text().trim();
          const teamLogo = $(teamDiv).find('img').attr('src') || null;
          const score = $(teamDiv).find('strong').text().trim();
          const overs = $(teamDiv).find('.ds-text-compact-xs').text().trim();
          teams.push({
            teamName,
            teamLogo,
            score,
            overs
          });
        });

        scorecardData.summary = {
          result,
          venue,
          teams
        };
      }

      // Check if any data was found
      if (scorecardData.tables.length === 0 && !scorecardData.summary) {
        return res.status(404).json({
          error: 'No scorecard data found',
          message: 'No match scorecard data is currently available.',
          data: { tables: [], summary: null }
        });
      }

      res.status(200).json({
        message: 'Match scorecard retrieved successfully',
        tableCount: scorecardData.tables.length,
        data: scorecardData
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: 'Scraping failed',
        message: 'Failed to retrieve match scorecard. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } finally {
      if (page) await page.close();
    }
  }
};

module.exports = scoreCardController;
