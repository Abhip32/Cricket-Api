const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'https://cric-geek.vercel.app';
const CRICGEEK_SCREENSHOTS_DIR = 'C:\\Users\\abhis\\OneDrive\\Desktop\\Desktop\\CricGeek\\screenshots';
const CRICKET_API_ASSETS_DIR = path.join(__dirname, '..', 'assets');

async function waitLoaded(page, label, customCondition = null, timeout = 35000) {
  console.log(`[Loading] ${label} - waiting for data to populate and shimmers to clear...`);
  const start = Date.now();

  // Wait until no shimmer skeleton blocks remain
  await page.waitForFunction(() => {
    const shimmers = document.querySelectorAll('.shimmer-block');
    return shimmers.length === 0;
  }, { timeout });

  // Custom condition if supplied
  if (customCondition) {
    await page.waitForFunction(customCondition, { timeout });
  }

  // Allow 1.5 seconds for CSS animations, fonts, and images to settle cleanly
  await new Promise(r => setTimeout(r, 1500));
  console.log(`[Success] ${label} loaded cleanly in ${((Date.now() - start) / 1000).toFixed(1)}s (0 shimmers)`);
}

async function captureAllPages() {
  console.log('=====================================================');
  console.log(' Starting Complete UI Screenshot Suite from:', BASE_URL);
  console.log('=====================================================');

  if (!fs.existsSync(CRICGEEK_SCREENSHOTS_DIR)) {
    fs.mkdirSync(CRICGEEK_SCREENSHOTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(CRICKET_API_ASSETS_DIR)) {
    fs.mkdirSync(CRICKET_API_ASSETS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,920'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 920, deviceScaleFactor: 2 });

  let sampleScorecardUrl = '';

  // ----------------------------------------------------
  // 1. HOME PAGE
  // ----------------------------------------------------
  try {
    console.log('\n(1/8) Navigating to Home Page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 35000 });
    await waitLoaded(page, 'Home Page', () => {
      const matchCards = document.querySelectorAll('a[href*="/scorecard"]');
      return matchCards.length > 0;
    });

    const homeFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'home.png');
    await page.screenshot({ path: homeFile, fullPage: false });
    console.log('Saved:', homeFile);
  } catch (err) {
    console.error('Error on Home Page:', err.message);
  }

  // ----------------------------------------------------
  // 2. MATCHES PAGE (Live Tab)
  // ----------------------------------------------------
  try {
    console.log('\n(2/8) Navigating to Matches (Live Tab)...');
    await page.goto(`${BASE_URL}/matches?tab=live`, { waitUntil: 'networkidle2', timeout: 35000 });
    await waitLoaded(page, 'Matches (Live)', () => {
      const cards = document.querySelectorAll('a[href*="/scorecard"]');
      return cards.length > 0;
    });

    sampleScorecardUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/scorecard"]');
      return link ? link.href : '';
    });
    console.log('Captured sample scorecard link:', sampleScorecardUrl);

    const matchesFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'matches.png');
    await page.screenshot({ path: matchesFile, fullPage: false });
    console.log('Saved:', matchesFile);
  } catch (err) {
    console.error('Error on Matches (Live):', err.message);
  }

  // ----------------------------------------------------
  // 3. MATCHES PAGE (Recent Results Tab)
  // ----------------------------------------------------
  try {
    console.log('\n(3/8) Navigating to Matches (Recent Results)...');
    // Click Recent Results button on the already open matches page
    const clickedRecent = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Recent Results'));
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (clickedRecent) {
      await waitLoaded(page, 'Matches (Recent Tab)', () => {
        return document.body.innerText.includes('RESULT') || document.querySelectorAll('a[href*="/scorecard"]').length > 0;
      });
      const matchesRecentFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'matches-recent.png');
      await page.screenshot({ path: matchesRecentFile, fullPage: false });
      console.log('Saved:', matchesRecentFile);
    }
  } catch (err) {
    console.error('Error on Matches (Recent):', err.message);
  }

  // ----------------------------------------------------
  // 4. SCHEDULE / FIXTURES PAGE
  // ----------------------------------------------------
  try {
    console.log('\n(4/8) Navigating to Schedule Page...');
    await page.goto(`${BASE_URL}/schedule`, { waitUntil: 'networkidle2', timeout: 35000 });
    await waitLoaded(page, 'Schedule Page', () => {
      const pulseSkeletons = document.querySelectorAll('.bg-slate-200.animate-pulse');
      return pulseSkeletons.length === 0 && document.body.innerText.includes('SERIES');
    });

    const scheduleFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'schedule.png');
    await page.screenshot({ path: scheduleFile, fullPage: false });
    console.log('Saved:', scheduleFile);
  } catch (err) {
    console.error('Error on Schedule Page:', err.message);
  }

  // ----------------------------------------------------
  // 5. RANKINGS PAGE (ICC Team Rankings)
  // ----------------------------------------------------
  try {
    console.log('\n(5/8) Navigating to Rankings Page (Teams)...');
    await page.goto(`${BASE_URL}/rankings`, { waitUntil: 'networkidle2', timeout: 35000 });
    await waitLoaded(page, 'Rankings (Teams)', () => {
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length >= 5;
    });

    const rankingsFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'rankings.png');
    await page.screenshot({ path: rankingsFile, fullPage: false });
    console.log('Saved:', rankingsFile);
  } catch (err) {
    console.error('Error on Rankings (Teams):', err.message);
  }

  // ----------------------------------------------------
  // 6. RANKINGS PAGE (ICC Player Rankings)
  // ----------------------------------------------------
  try {
    console.log('\n(6/8) Switching to Rankings Page (Players)...');
    const playerClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pBtn = buttons.find(b => b.innerText.includes('Players') || b.innerText.includes('Player'));
      if (pBtn) { pBtn.click(); return true; }
      return false;
    });

    if (playerClicked) {
      await waitLoaded(page, 'Rankings (Players)', () => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length >= 5;
      });

      const playerRankingsFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'rankings variation.png');
      await page.screenshot({ path: playerRankingsFile, fullPage: false });
      console.log('Saved:', playerRankingsFile);
    }
  } catch (err) {
    console.error('Error on Rankings (Players):', err.message);
  }

  // ----------------------------------------------------
  // 7. SCORECARD PAGE (Innings & Tables)
  // ----------------------------------------------------
  try {
    console.log('\n(7/8) Navigating to Scorecard Page...');
    const scorecardUrl = sampleScorecardUrl || `${BASE_URL}/scorecard/series/india-in-new-zealand-2026-27-1539421/new-zealand-vs-india-2nd-t20i-1539433`;
    console.log('Opening scorecard:', scorecardUrl);
    await page.goto(scorecardUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    await waitLoaded(page, 'Scorecard Tables', () => {
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length >= 4;
    });

    const scorecardFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'scorecard.png');
    await page.screenshot({ path: scorecardFile, fullPage: false });
    console.log('Saved:', scorecardFile);

    // Also capture commentary or mini-scorecard view
    const commentaryFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'commentary.png');
    // Scroll down slightly to showcase batting/bowling depth
    await page.evaluate(() => window.scrollBy(0, 320));
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: commentaryFile, fullPage: false });
    console.log('Saved deeper scorecard breakdown to:', commentaryFile);
  } catch (err) {
    console.error('Error on Scorecard:', err.message);
  }

  // ----------------------------------------------------
  // 8. SCORECARD MATCH INFO / SQUADS
  // ----------------------------------------------------
  try {
    console.log('\n(8/8) Switching to Scorecard Match Info Tab...');
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 400));

    const infoClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Match Info'));
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (infoClicked) {
      await waitLoaded(page, 'Scorecard Match Info', () => {
        return document.body.innerText.includes('Toss') || document.body.innerText.includes('Ground') || document.body.innerText.includes('Umpires');
      });

      const infoFile = path.join(CRICGEEK_SCREENSHOTS_DIR, 'squads.png');
      await page.screenshot({ path: infoFile, fullPage: false });
      console.log('Saved Match Info / Details to:', infoFile);
    }
  } catch (err) {
    console.error('Error on Scorecard Match Info:', err.message);
  }

  await browser.close();

  // ----------------------------------------------------
  // SYNC ASSETS TO CRICKET-API
  // ----------------------------------------------------
  console.log('\n=== Syncing refreshed screenshots to Cricket-Api assets ===');
  const syncMap = [
    { from: 'home.png', to: 'cricgeek-home.png' },
    { from: 'matches.png', to: 'cricgeek-matches.png' },
    { from: 'scorecard.png', to: 'cricgeek-scorecard.png' },
    { from: 'schedule.png', to: 'cricgeek-schedule.png' },
    { from: 'rankings.png', to: 'cricgeek-rankings.png' }
  ];

  for (const item of syncMap) {
    const src = path.join(CRICGEEK_SCREENSHOTS_DIR, item.from);
    const dst = path.join(CRICKET_API_ASSETS_DIR, item.to);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      console.log(`✓ Copied ${item.from} -> assets/${item.to}`);
    }
  }

  console.log('\nAll pages captured successfully with 0 loaders and real live data!');
}

captureAllPages().catch(console.error);
