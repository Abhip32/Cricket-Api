const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'https://cric-geek.vercel.app';
const CRICGEEK_SCREENSHOTS_DIR = 'C:\\Users\\abhis\\OneDrive\\Desktop\\Desktop\\CricGeek\\screenshots';
const CRICKET_API_ASSETS_DIR = path.join(__dirname, '..', 'assets');

async function capture() {
  console.log('Starting UI screenshot capture from:', BASE_URL);

  if (!fs.existsSync(CRICGEEK_SCREENSHOTS_DIR)) {
    fs.mkdirSync(CRICGEEK_SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  // 1. Home Page
  console.log('Capturing Home Page...');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500)); // allow animations and dynamic data to settle
    await page.screenshot({ path: path.join(CRICGEEK_SCREENSHOTS_DIR, 'home.png'), fullPage: false });
    console.log('Saved home.png');
  } catch (e) {
    console.error('Failed to capture Home:', e.message);
  }

  // 2. Matches Page
  console.log('Capturing Matches Page...');
  try {
    await page.goto(`${BASE_URL}/matches`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(CRICGEEK_SCREENSHOTS_DIR, 'matches.png'), fullPage: false });
    console.log('Saved matches.png');
  } catch (e) {
    console.error('Failed to capture Matches:', e.message);
  }

  // 3. Schedule Page
  console.log('Capturing Schedule Page...');
  try {
    await page.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(CRICGEEK_SCREENSHOTS_DIR, 'schedule.png'), fullPage: false });
    console.log('Saved schedule.png');
  } catch (e) {
    console.error('Failed to capture Schedule:', e.message);
  }

  // 4. Rankings Page
  console.log('Capturing Rankings Page...');
  try {
    await page.goto(`${BASE_URL}/rankings`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(CRICGEEK_SCREENSHOTS_DIR, 'rankings.png'), fullPage: false });
    console.log('Saved rankings.png');
  } catch (e) {
    console.error('Failed to capture Rankings:', e.message);
  }

  // 5. Scorecard Page (find a match link or go to /scorecard)
  console.log('Capturing Scorecard Page...');
  try {
    // Go to matches to find a scorecard link
    await page.goto(`${BASE_URL}/matches`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    const scorecardLink = await page.$('a[href*="/scorecard"]');
    if (scorecardLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        scorecardLink.click()
      ]);
    } else {
      await page.goto(`${BASE_URL}/scorecard`, { waitUntil: 'networkidle2', timeout: 30000 });
    }
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(CRICGEEK_SCREENSHOTS_DIR, 'scorecard.png'), fullPage: false });
    console.log('Saved scorecard.png');
  } catch (e) {
    console.error('Failed to capture Scorecard:', e.message);
  }

  await browser.close();

  // Copy refreshed screenshots to Cricket-Api assets
  console.log('Updating Cricket-Api assets...');
  if (fs.existsSync(path.join(CRICGEEK_SCREENSHOTS_DIR, 'matches.png'))) {
    fs.copyFileSync(
      path.join(CRICGEEK_SCREENSHOTS_DIR, 'matches.png'),
      path.join(CRICKET_API_ASSETS_DIR, 'cricgeek-matches.png')
    );
  }
  if (fs.existsSync(path.join(CRICGEEK_SCREENSHOTS_DIR, 'scorecard.png'))) {
    fs.copyFileSync(
      path.join(CRICGEEK_SCREENSHOTS_DIR, 'scorecard.png'),
      path.join(CRICKET_API_ASSETS_DIR, 'cricgeek-scorecard.png')
    );
  }
  if (fs.existsSync(path.join(CRICGEEK_SCREENSHOTS_DIR, 'home.png'))) {
    fs.copyFileSync(
      path.join(CRICGEEK_SCREENSHOTS_DIR, 'home.png'),
      path.join(CRICKET_API_ASSETS_DIR, 'cricgeek-home.png')
    );
  }

  console.log('All fresh UI screenshots captured and synced successfully!');
}

capture().catch(console.error);
