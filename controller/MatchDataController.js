const cheerio = require('cheerio');


async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500; // px per scroll
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100); // wait 100ms per scroll
    });
  });
}

const MatchDataController = {
  getLiveMatches :async (req, res) => {
  let page;

  try {
    const browser = global.getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    await page.goto(
      'https://www.espncricinfo.com/live-cricket-score',
      { waitUntil: 'networkidle2', timeout: 0 }
    );
    // Scroll to load all lazy content
    await autoScroll(page);

    const html = await page.content();
    const $ = cheerio.load(html);

    const response = [];

    // 👉 Each SERIES block
    $('.ds-w-full.ds-bg-fill-content-prime').each((i, seriesEl) => {
      const series = {};

      // Series name
      series.series = $(seriesEl)
        .find('h2 span.ds-text-title-xs')
        .first()
        .text()
        .trim();

      series.matches = [];

      // 👉 Each MATCH card inside series
      $(seriesEl)
        .find('.ds-border-b.ds-border-line.ds-w-full')
        .each((j, matchEl) => {
          const match = {};

          // Match link
          const linkEl = $(matchEl).find('a.ds-no-tap-higlight').first();
          match.link = linkEl.attr('href')
            ? `https://www.espncricinfo.com${linkEl.attr('href')}`
            : null;

          // Status (RESULT / LIVE / Today 7:30 PM)
          match.status = $(matchEl)
            .find('.ds-text-tight-xs.ds-font-bold.ds-uppercase')
            .first()
            .text()
            .trim();

          // Match info
          match.matchInfo = $(matchEl)
            .find('.ds-text-tight-xs.ds-text-typo-mid3')
            .first()
            .text()
            .trim();

          // Teams
          match.teams = [];

          $(matchEl).find('.ci-team-score').each((k, teamEl) => {
            const team = {};

            team.name = $(teamEl)
              .find('p.ds-text-tight-m')
              .text()
              .trim();

            team.flag = $(teamEl).find('img').attr('src') || null;

            const metaText = $(teamEl)
              .find('span.ds-text-compact-xs')
              .text()
              .trim(); // (19/20 ov, T:196)

            if (metaText) {
              const cleaned = metaText.replace(/[()]/g, '');
              cleaned.split(',').forEach(part => {
                if (part.includes('ov')) team.overs = part.trim();
                if (part.includes('T:')) team.target = part.trim();
              });
            }

            team.score = $(teamEl)
              .find('strong')
              .text()
              .trim();

            team.fullScore = metaText
              ? `${team.score} ${metaText}`
              : team.score;

            match.teams.push(team);
          });

          // Result / Preview text
          match.result = $(matchEl)
            .find('p.ds-text-tight-s.ds-font-medium')
            .text()
            .trim();

          if (match.teams.length >= 2) {
            series.matches.push(match);
          }
        });

      if (series.matches.length > 0) {
        response.push(series);
      }
    });

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scraping failed' });
  } finally {
    if (page) await page.close();
  }
},


  getRecentMatches : async (req, res) => {
  let page;

  try {
    const browser = global.getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    await page.goto(
      'https://www.espncricinfo.com/live-cricket-match-results',
      { waitUntil: 'networkidle2', timeout: 0 }
    );
    // Scroll to load all lazy content
    await autoScroll(page);

    const html = await page.content();
    const $ = cheerio.load(html);

    const response = [];

    // 👉 Each SERIES block
    $('.ds-w-full.ds-bg-fill-content-prime').each((i, seriesEl) => {
      const series = {};

      // Series name
      series.series = $(seriesEl)
        .find('h2 span.ds-text-title-xs')
        .first()
        .text()
        .trim();

      series.matches = [];

      // 👉 Each MATCH card inside series
      $(seriesEl)
        .find('.ds-border-b.ds-border-line.ds-w-full')
        .each((j, matchEl) => {
          const match = {};

          // Match link
          const linkEl = $(matchEl).find('a.ds-no-tap-higlight').first();
          match.link = linkEl.attr('href')
            ? `https://www.espncricinfo.com${linkEl.attr('href')}`
            : null;

          // Status (RESULT / LIVE / Today 7:30 PM)
          match.status = $(matchEl)
            .find('.ds-text-tight-xs.ds-font-bold.ds-uppercase')
            .first()
            .text()
            .trim();

          // Match info
          match.matchInfo = $(matchEl)
            .find('.ds-text-tight-xs.ds-text-typo-mid3')
            .first()
            .text()
            .trim();

          // Teams
          match.teams = [];

          $(matchEl).find('.ci-team-score').each((k, teamEl) => {
            const team = {};

            team.name = $(teamEl)
              .find('p.ds-text-tight-m')
              .text()
              .trim();

            team.flag = $(teamEl).find('img').attr('src') || null;

            const metaText = $(teamEl)
              .find('span.ds-text-compact-xs')
              .text()
              .trim(); // (19/20 ov, T:196)

            if (metaText) {
              const cleaned = metaText.replace(/[()]/g, '');
              cleaned.split(',').forEach(part => {
                if (part.includes('ov')) team.overs = part.trim();
                if (part.includes('T:')) team.target = part.trim();
              });
            }

            team.score = $(teamEl)
              .find('strong')
              .text()
              .trim();

            team.fullScore = metaText
              ? `${team.score} ${metaText}`
              : team.score;

            match.teams.push(team);
          });

          // Result / Preview text
          match.result = $(matchEl)
            .find('p.ds-text-tight-s.ds-font-medium')
            .text()
            .trim();

          if (match.teams.length >= 2) {
            series.matches.push(match);
          }
        });

      if (series.matches.length > 0) {
        response.push(series);
      }
    });

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scraping failed' });
  } finally {
    if (page) await page.close();
  }


  },

getUpcomingMatches: async (req, res) => {
  const date = req.query.date;
  let page;
  try {
    const browser = global.getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    await page.goto(
      'https://www.espncricinfo.com/live-cricket-match-schedule-fixtures?date=' + date,
      { waitUntil: 'networkidle2', timeout: 0 }
    );

    await autoScroll(page); // scroll to load all lazy content

    const html = await page.content();
    const $ = cheerio.load(html);

    const response = [];

    $('.ds-mb-6').each((i, dateBlock) => {
      const date = $(dateBlock).find('span.ds-text-tight-s').first().text().trim();

      // loop over actual match cards
      $(dateBlock).find('div.ds-bg-fill-content-prime').each((j, cardEl) => {
        const teams = $(cardEl).find('p.ds-text-compact-s').first().text().trim();
        if (!teams) return; // skip empty cards

        const venueInfoFull = $(cardEl).find('div.ds-text-tight-xs').first().text().trim();
        const venueParts = venueInfoFull.split(',');
        const venueInfo = venueParts.slice(1).join(',').trim(); // skip match number

        const seriesName = $(cardEl).find('a.ds-inline-flex span').first().text().trim();
        const startTime = $(cardEl).find('time').first().text().trim();

        const linkEl = $(cardEl).find('a').first();
        const link = linkEl.attr('href') ? `https://www.espncricinfo.com${linkEl.attr('href')}` : null;

        response.push({
          date,
          teams,
          venueInfo,
          seriesName,
          startTime,
          link
        });
      });
    });

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scraping failed' });
  } finally {
    if (page) await page.close();
  }
}



};

module.exports = MatchDataController;
