const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const CRICGEEK_SCREENSHOTS = 'C:\\Users\\abhis\\OneDrive\\Desktop\\Desktop\\CricGeek\\screenshots';
const CRICKET_API_ASSETS = 'C:\\Users\\abhis\\OneDrive\\Desktop\\Desktop\\Cricket-Api\\assets';

async function saveToBoth(page, filename, options = { fullPage: false }) {
  const p1 = path.join(CRICGEEK_SCREENSHOTS, filename);
  const p2 = path.join(CRICKET_API_ASSETS, filename);
  
  await page.screenshot({ path: p1, ...options });
  fs.copyFileSync(p1, p2);
  console.log(`[Screenshot Saved] -> ${filename}`);
}

async function waitSettled(ms = 1800) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('=== Starting Screenshot Generation from', BASE_URL, '===');

  if (!fs.existsSync(CRICGEEK_SCREENSHOTS)) fs.mkdirSync(CRICGEEK_SCREENSHOTS, { recursive: true });
  if (!fs.existsSync(CRICKET_API_ASSETS)) fs.mkdirSync(CRICKET_API_ASSETS, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,920']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 920, deviceScaleFactor: 1.5 });

  let sampleScorecardUrl = '';

  // 1. HOME PAGE
  try {
    console.log('(1/10) Home Page...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'a-home.png');
    await saveToBoth(page, 'home.png');
    await saveToBoth(page, 'preview.png');
  } catch (e) {
    console.error('Home Page error:', e.message);
  }

  // 2. MATCHES (LIVE)
  try {
    console.log('(2/10) Matches (Live)...');
    await page.goto(`${BASE_URL}/matches?tab=live`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'matches.png');

    sampleScorecardUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/scorecard"]');
      return link ? link.href : '';
    });
    console.log('Sample scorecard URL:', sampleScorecardUrl);
  } catch (e) {
    console.error('Matches Live error:', e.message);
  }

  // 3. MATCHES (RECENT)
  try {
    console.log('(3/10) Matches (Recent)...');
    await page.goto(`${BASE_URL}/matches?tab=recent`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'matches-recent.png');
  } catch (e) {
    console.error('Matches Recent error:', e.message);
  }

  // 4. MATCHES (UPCOMING)
  try {
    console.log('(4/10) Matches (Upcoming)...');
    await page.goto(`${BASE_URL}/matches?tab=upcoming`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'matches-upcoming.png');
  } catch (e) {
    console.error('Matches Upcoming error:', e.message);
  }

  // 5. SCHEDULE
  try {
    console.log('(5/10) Schedule...');
    await page.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'schedule.png');
  } catch (e) {
    console.error('Schedule error:', e.message);
  }

  // 6. RANKINGS (TEAMS)
  try {
    console.log('(6/10) Rankings (Teams)...');
    await page.goto(`${BASE_URL}/rankings`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'rankings.png');
  } catch (e) {
    console.error('Rankings Teams error:', e.message);
  }

  // 7. RANKINGS (PLAYERS)
  try {
    console.log('(7/10) Rankings (Players)...');
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Player Rankings'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      await waitSettled(2000);
      await saveToBoth(page, 'rankings-players.png');
      await saveToBoth(page, 'rankings variation.png');
    }
  } catch (e) {
    console.error('Rankings Players error:', e.message);
  }

  // 8. PHOTOS
  try {
    console.log('(8/10) Photos Gallery...');
    await page.goto(`${BASE_URL}/photos`, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitSettled(2000);
    await saveToBoth(page, 'photos.png');
  } catch (e) {
    console.error('Photos error:', e.message);
  }

  // 9. SCORECARD & TABS
  const targetScorecard = sampleScorecardUrl || `${BASE_URL}/scorecard/series/24756/game/1553295/bangladesh-vs-west-indies-1st-test-24756`;
  try {
    console.log('(9/10) Scorecard Main (Batting/Bowling)...', targetScorecard);
    await page.goto(targetScorecard, { waitUntil: 'networkidle2', timeout: 35000 });
    await waitSettled(2500);
    await saveToBoth(page, 'scorecard.png');

    // Click Partnership pill in the first innings
    console.log('Switching innings view to Partnership pill...');
    const clickedPart = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('PARTNERSHIP') || b.innerText.includes('Partnership'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clickedPart) {
      await waitSettled(1500);
      await saveToBoth(page, 'scorecard-partnerships.png');
    }

    // Commentary Tab
    console.log('Switching to Commentary tab...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('COMMENTARY') || b.innerText.includes('Commentary'));
      if (btn) btn.click();
    });
    await waitSettled(2000);
    await saveToBoth(page, 'commentary.png');
    await saveToBoth(page, 'scorecard-commentary.png');

    // Squads / Match Info Tab
    console.log('Switching to Squads / Match Info tab...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('SQUADS') || b.innerText.includes('Squads') || b.innerText.includes('MATCH INFO') || b.innerText.includes('Match Info'));
      if (btn) btn.click();
    });
    await waitSettled(2000);
    await saveToBoth(page, 'scorecard-info.png');
    await saveToBoth(page, 'squads.png');

    // MVP Tab
    console.log('Switching to MVP tab...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('MVP') || b.innerText.includes('Mvp'));
      if (btn) btn.click();
    });
    await waitSettled(2000);
    await saveToBoth(page, 'scorecard-mvp.png');

  } catch (e) {
    console.error('Scorecard error:', e.message);
  }

  await browser.close();
  console.log('=== All Screenshots Generated and Synced Successfully! ===');
}

run().catch(console.error);
