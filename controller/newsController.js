const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');

const newsController = {
  getNews: async (req, res) => {
    const cacheKey = 'cricket_news';
    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      const html = await fetchPageHtml('https://www.espncricinfo.com/cricket-news', {
        waitMs: 1500
      });
      const $ = cheerio.load(html);
      const newsList = [];

      $('.ds-border-b.ds-border-line.ds-p-4').each((i, card) => {
        const $card = $(card);
        const titleEl = $card.find('p.ds-text-title-s, h2').first();
        const title = titleEl.text().trim();
        if (!title) return;

        // Article Link - ensure clean absolute URL
        const linkEl = $card.find('a[href*="/story/"], a').first();
        let link = linkEl.attr('href') || null;
        if (link && !link.startsWith('http')) {
          link = `https://www.espncricinfo.com${link}`;
        }

        // Description
        let description = '';
        const descDiv = $card.find('.ds-w-4\\/5 div.ds-flex-col > div, div[class*="ds-w-4/5"] div.ds-flex-col > div').filter((_, el) => {
          return !$(el).hasClass('ds-leading-[0]') && $(el).text().trim().length > 0;
        }).first();

        if (descDiv.length) {
          description = descDiv.text().trim();
        } else {
          // Fallback description
          $card.find('p[class*="ds-text-compact-s"], p.ds-text-tight-m').each((_, p) => {
            const t = $(p).text().trim();
            if (t && t !== title && !description) {
              description = t;
            }
          });
        }

        // Date and Author
        const spans = $card.find('.ds-text-compact-xs span, span[class*="ds-text-compact-xs"]');
        let dateTime = '';
        let author = '';
        spans.each((_, sp) => {
          const text = $(sp).text().trim();
          if (!text || text === '•') return;
          if (text.includes('ago') || text.includes('202') || text.includes('hrs') || text.includes('mins')) {
            dateTime = text;
          } else if (!author) {
            author = text;
          }
        });

        // Image
        const image = $card.find('img').attr('src') || null;

        newsList.push({
          title,
          description,
          dateTime,
          author,
          image,
          link
        });
      });

      // Cache news for 10 minutes
      cacheService.set(cacheKey, newsList, 10 * 60 * 1000);

      res.status(200).json(newsList);
    } catch (err) {
      console.error('getNews error:', err.message);
      res.status(500).json({ error: 'Scraping news failed', message: err.message });
    }
  }
};

module.exports = newsController;
