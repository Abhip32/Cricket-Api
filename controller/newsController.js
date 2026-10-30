const cheerio = require('cheerio');
const { fetchPageHtml } = require('../services/browserService');
const cacheService = require('../services/cacheService');

/**
 * Ultra-fast direct ESPN Official News API (< 120ms)
 * Immune to Akamai 403 blocks on Vercel
 * Supports global cricket news (leagueId: '0') or specific tournament news (e.g. IPL 8048)
 */
async function fetchEspnApiNews(leagueId = '0') {
  try {
    const cleanId = String(leagueId).trim();
    const url = `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${cleanId}/news`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const rawArticles = data.articles || [];
    if (rawArticles.length === 0) return null;

    return rawArticles.map((a) => {
      const img = a.images?.[0]?.url || null;
      return {
        title: a.headline || '',
        headline: a.headline || '',
        description: a.description || '',
        image: img,
        date: a.published || '',
        dateTime: a.published || '',
        author: a.byline || 'ESPNcricinfo staff',
        link: a.links?.web?.href || a.links?.mobile?.href || null,
        categories: (a.categories || []).map((c) => c.description || c.type),
        raw: a
      };
    });
  } catch (e) {
    return null;
  }
}

/**
 * Ultra-fast RSS XML parser (< 300ms) fallback
 */
async function fetchRssNews() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://www.espncricinfo.com/rss/content/story/feeds/0.xml', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const newsList = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim();
      if (!title) return;
      const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim();
      const description = $(el).find('description').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const image = $(el).find('enclosure').attr('url') || $(el).find('coverImages').text().trim() || null;
      const author = $(el).find('dc\\:creator, author').text().trim() || 'ESPNcricinfo staff';

      newsList.push({
        title,
        headline: title,
        description,
        image,
        date: pubDate,
        dateTime: pubDate,
        author,
        link,
        raw: {
          title,
          link,
          description,
          image,
          pubDate,
          author
        }
      });
    });

    return newsList.length > 0 ? newsList : null;
  } catch (e) {
    return null;
  }
}

const newsController = {
  getNews: async (req, res) => {
    const leagueId = req.query.leagueId || req.query.league || '0';
    const cacheKey = `cricket_news_${leagueId}`;

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      // 1. Direct ESPN Official News API (Instant, structured, high-res images)
      const espnNews = await fetchEspnApiNews(leagueId);
      if (espnNews && espnNews.length > 0) {
        cacheService.set(cacheKey, espnNews, 10 * 60 * 1000);
        return res.status(200).json(espnNews);
      }

      // 2. RSS news feed fallback (~300ms)
      const rssNews = await fetchRssNews();
      if (rssNews && rssNews.length > 0) {
        cacheService.set(cacheKey, rssNews, 10 * 60 * 1000);
        return res.status(200).json(rssNews);
      }

      // 3. Fall back to HTML scraping
      const html = await fetchPageHtml('https://www.espncricinfo.com/cricket-news');
      const $ = cheerio.load(html);
      const newsList = [];

      $('.ds-border-b.ds-border-line.ds-p-4').each((i, card) => {
        const $card = $(card);
        const titleEl = $card.find('p[class*="ds-text-title"], h2, [class*="ds-font-medium"]').filter((_, el) => {
          return $(el).text().trim().length > 10;
        }).first();
        const title = titleEl.text().trim();
        if (!title) return;

        // Article Link
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

        // Image extraction
        let image = null;
        const img = $card.find('img').first();
        if (img.length) {
          const dataSrc = img.attr('data-src') || img.attr('data-default-src');
          const srcset = img.attr('srcset');
          const src = img.attr('src');

          let candidate = dataSrc;
          if (!candidate && srcset) {
            candidate = srcset.split(',')[0].trim().split(' ')[0];
          }
          if (!candidate) {
            candidate = src;
          }

          if (candidate && !candidate.includes('lazyimage') && !candidate.startsWith('data:')) {
            image = candidate.startsWith('http') ? candidate : `https://www.espncricinfo.com${candidate}`;
          }
        }

        newsList.push({
          title,
          headline: title,
          description,
          dateTime,
          author,
          image,
          link
        });
      });

      cacheService.set(cacheKey, newsList, 10 * 60 * 1000);
      res.status(200).json(newsList);
    } catch (err) {
      console.error('getNews error:', err.message);
      res.status(500).json({ error: 'Scraping news failed', message: err.message });
    }
  }
};

module.exports = newsController;
