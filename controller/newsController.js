const puppeteer = require('puppeteer');

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

const newsController = {
  getNews: async (req, res) => {
    let page;
    try {
      const browser = global.getBrowser(); // your global Puppeteer browser
      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      await page.goto(
        'https://www.espncricinfo.com/cricket-news',
        { waitUntil: 'networkidle2', timeout: 0 }
      );

      // Scroll to load all lazy images/content
      await autoScroll(page);

      // Extract news directly in browser context
      const newsList = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.ds-border-b.ds-border-line.ds-p-4')).map(card => {
    const titleEl = card.querySelector('p.ds-text-title-s');
    const title = titleEl ? titleEl.innerText.trim() : '';

    // Select parent div using class contains to avoid invalid selectors
    const parentDiv = card.querySelector('div[class*="ds-w-4/5"] div.ds-flex-col');
    let description = '';
    if (parentDiv) {
      description = Array.from(parentDiv.children)
        .filter(el => !el.classList.contains('ds-leading-[0]') && !el.classList.contains('ds-text-title-s'))
        .map(el => el.innerText.trim())
        .join(' ');
    }

    const spans = card.querySelectorAll('.ds-text-compact-xs span');
    const dateTime = spans[0]?.innerText.trim() || '';
    const author = spans[2]?.innerText.trim() || '';
    const image = card.querySelector('img')?.src || null;
    const linkEl = card.querySelector('a');
    const link = linkEl?.href ? `https://www.espncricinfo.com${linkEl.href}` : null;

    return { title, description, dateTime, author, image, link };
  });
});


      res.status(200).json(newsList);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Scraping news failed' });
    } finally {
      if (page) await page.close();
    }
  }
};

module.exports = newsController;
