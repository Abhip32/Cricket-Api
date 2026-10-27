const cheerio = require('cheerio');
const cacheService = require('../services/cacheService');

/**
 * High-definition Cricket Photos & Gallery Controller
 * Sourced directly from Cricbuzz's official high-res gallery feed (750x422 & original CDN)
 */
const PhotoController = {
  getPhotos: async (req, res) => {
    const galleryId = req.query.id ? String(req.query.id).trim() : '';
    const cacheKey = galleryId ? `cricbuzz_gallery_${galleryId}` : 'cricbuzz_photos_main';

    if (!cacheService.isBypassed(req)) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.status(200).json(cached);
      }
    }

    try {
      if (galleryId) {
        // Fetch specific gallery photos
        const targetUrl = galleryId.startsWith('http')
          ? galleryId
          : `https://www.cricbuzz.com/cricket-gallery/${galleryId}`;

        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          }
        });

        if (!response.ok) {
          return res.status(404).json({ error: 'Gallery not found' });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('h1').text().trim() || $('title').text().replace(/\s*\|.*$/, '').trim();
        const photos = [];

        $('img[src*="cricbuzz.com"]').each((i, el) => {
          const src = $(el).attr('src');
          const caption = $(el).attr('alt') || $(el).attr('title') || '';
          if (src && src.includes('/i1/c')) {
            const highRes = src.replace(/\/\d+x\d+\//, '/750x422/');
            photos.push({
              id: `${galleryId}_${i}`,
              url: highRes,
              thumbnail: src,
              caption: caption.replace(/\s*-\s*Cricbuzz.*$/i, '').trim()
            });
          }
        });

        const result = {
          galleryId,
          title,
          count: photos.length,
          photos
        };

        cacheService.set(cacheKey, result, 60 * 60 * 1000);
        return res.status(200).json(result);
      }

      // Fetch Main Photos Galleries Feed
      const response = await fetch('https://www.cricbuzz.com/cricket-photo-gallery', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch photos feed' });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const galleries = [];
      const seen = new Set();

      $('a[href*="/cricket-gallery/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const idMatch = href.match(/\/cricket-gallery\/(\d+)/);
        const id = idMatch ? idMatch[1] : href;

        if (id && seen.has(id)) return;
        if (id) seen.add(id);

        let title = $(el).find('img').attr('title') || $(el).attr('title') || $(el).text().trim();
        let img = $(el).find('img').attr('src') || $(el).find('img').attr('source') || $(el).find('img').attr('data-src') || '';

        if (img && !img.startsWith('http')) {
          img = `https://www.cricbuzz.com${img}`;
        }
        if (img && img.includes('/i1/c')) {
          img = img.replace(/\/\d+x\d+\//, '/750x422/');
        }

        if (href && (img || title)) {
          galleries.push({
            id,
            title: title || 'Cricket Gallery',
            image: img,
            link: href.startsWith('http') ? href : `https://www.cricbuzz.com${href}`,
            source: 'Cricbuzz'
          });
        }
      });

      cacheService.set(cacheKey, galleries, 30 * 60 * 1000);
      res.status(200).json(galleries);
    } catch (err) {
      console.error('getPhotos error:', err.message);
      res.status(500).json({ error: 'Failed to retrieve cricket photos', message: err.message });
    }
  }
};

module.exports = PhotoController;
