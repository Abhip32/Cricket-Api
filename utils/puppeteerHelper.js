const { getBrowser } = require('./browserManager');

async function setupPage(browser, url) {
  const page = await browser.newPage();
  
  // Block unnecessary resources
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

  // Navigate to URL if provided
  if (url) {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    });
  }

  return page;
}

module.exports = {
  setupPage
}; 