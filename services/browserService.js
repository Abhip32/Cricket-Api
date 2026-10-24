const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

let browserInstance = null;
let isInitializing = false;

// Check if running in a serverless environment (e.g. Vercel, AWS Lambda)
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.VERCEL_ENV
);

// Matching pack tarball for @sparticuz/chromium-min v123.0.1
const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar';

/**
 * Locates Chrome / Edge on local machines across Windows, macOS, and Linux
 */
function getLocalExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Check if standard puppeteer is installed and has cached a browser
  try {
    const p = require('puppeteer');
    if (typeof p.executablePath === 'function') {
      const pPath = p.executablePath();
      if (pPath && fs.existsSync(pPath)) return pPath;
    }
  } catch (e) {
    // ignore
  }

  // Windows standard paths
  const winPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.PROGRAMFILES || 'C:\\Program Files') + '\\Google\\Chrome\\Application\\chrome.exe',
    (process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)') + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of winPaths) {
    if (p && fs.existsSync(p)) return p;
  }

  // macOS standard paths
  const macPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  for (const p of macPaths) {
    if (fs.existsSync(p)) return p;
  }

  // Linux standard paths
  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];
  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    'No local Chrome / Chromium executable found. Please install Google Chrome or set PUPPETEER_EXECUTABLE_PATH.'
  );
}

/**
 * Initializes and returns the shared Puppeteer browser instance.
 * Automatically restarts browser if it was closed or crashed.
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Prevent race conditions when multiple requests arrive concurrently during initialization
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

    let executablePath = null;
    let launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--memory-pressure-off'
    ];
    let defaultViewport = null;
    let headless = 'new';

    if (isServerless) {
      console.log(`[BrowserService] Running in serverless mode. Initializing Chromium via @sparticuz/chromium-min...`);
      let chromium = null;
      try {
        chromium = require('@sparticuz/chromium-min');
      } catch (e) {
        try {
          chromium = require('@sparticuz/chromium');
        } catch (err) {
          throw new Error('Neither @sparticuz/chromium-min nor @sparticuz/chromium is installed.');
        }
      }

      executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
      launchArgs = [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ];
      defaultViewport = chromium.defaultViewport;
      headless = chromium.headless;
    } else {
      executablePath = getLocalExecutablePath();
      console.log(`[BrowserService] Running in local mode. Using browser at: ${executablePath}`);
    }

    browserInstance = await puppeteer.launch({
      executablePath,
      args: launchArgs,
      defaultViewport,
      headless
    });

    browserInstance.on('disconnected', () => {
      console.warn('[BrowserService] Puppeteer browser disconnected. Will re-initialize on next request.');
      browserInstance = null;
    });

    console.log('[BrowserService] Puppeteer browser instance initialized successfully.');
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

  let browser = await getBrowser();
  let page = null;

  try {
    try {
      page = await browser.newPage();
    } catch (err) {
      console.warn('[BrowserService] Failed to open new page. Re-initializing browser...', err.message);
      await closeBrowser();
      browser = await getBrowser();
      page = await browser.newPage();
    }

    // Set real desktop Chrome User-Agent and headers
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
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
        console.error('[BrowserService] Error closing page:', err.message);
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
