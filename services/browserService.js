const puppeteer = require('puppeteer');

let browserInstance = null;
let isInitializing = false;

/**
 * Initializes and returns the shared Puppeteer browser instance.
 * Automatically restarts browser if it was closed or crashed.
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Prevent race condition if multiple requests try to init at the same time
  while (isInitializing) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (browserInstance && browserInstance.isConnected()) {
      return browserInstance;
    }
  }

  isInitializing = true;
  try {
    if (browserInstance) {
      try {
        await browserInstance.close();
      } catch (e) {
        // ignore
      }
      browserInstance = null;
    }

    browserInstance = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--memory-pressure-off',
        '--max_old_space_size=2048'
      ]
    });

    browserInstance.on('disconnected', () => {
      console.warn('Puppeteer browser disconnected. Will re-initialize on next request.');
      browserInstance = null;
    });

    console.log('Puppeteer browser instance initialized successfully.');
    return browserInstance;
  } finally {
    isInitializing = false;
  }
}

/**
 * Loads a URL and returns its full HTML content.
 * Optimizes speed by blocking media and fonts while preserving HTML markup.
 */
async function fetchPageHtml(url, options = {}) {
  const {
    timeout = 25000,
    waitMs = 1200,
    blockMedia = true,
    scrollTriggerLazy = false
  } = options;

  const browser = await getBrowser();
  let page = null;

  try {
    page = await browser.newPage();

    // Set real desktop Chrome User-Agent and headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    });

    // Speed up navigation by intercepting and aborting media and fonts
    if (blockMedia) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (['font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    // Navigate with domcontentloaded
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout
    });

    // If requested, fast-scroll to trigger lazy-loaded images/IntersectionObservers
    if (scrollTriggerLazy) {
      await page.evaluate(async () => {
        const total = document.body.scrollHeight;
        for (let y = 0; y < total; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 50));
        }
        window.scrollTo(0, 0);
      });
    }

    // Wait a brief moment for dynamic React components / image swaps to settle
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const html = await page.content();
    return html;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (err) {
        console.error('Error closing page:', err.message);
      }
    }
  }
}

/**
 * Gracefully closes the browser
 */
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) {
      // ignore
    }
    browserInstance = null;
  }
}

module.exports = {
  getBrowser,
  fetchPageHtml,
  closeBrowser
};
