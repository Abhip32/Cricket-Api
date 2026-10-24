const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function generate() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Fetch live match data
  let matchData = null;
  try {
    const res = await fetch('https://cricket-api-nu.vercel.app/getLive');
    if (res.ok) {
      matchData = await res.json();
    }
  } catch (e) {
    console.warn('Could not fetch from live url, falling back to local controller');
  }

  if (!matchData || !matchData.length) {
    const controller = require('../controller/MatchDataController');
    await controller.getLiveMatches({ query: {} }, { status: () => ({ json: d => { matchData = d; } }) });
  }

  const sampleSeries = matchData && matchData.length ? matchData[0] : {
    series: "India tour of New Zealand 2026",
    matches: [
      {
        link: "https://www.espncricinfo.com/series/india-in-new-zealand-2026-27-1539421/new-zealand-vs-india-2nd-t20i-1539433/full-scorecard",
        status: "RESULT",
        matchInfo: "2nd T20I (N), Christchurch, October 24, 2026",
        teams: [
          {
            name: "New Zealand",
            flag: "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340500/340505.png",
            score: "180/5",
            fullScore: "180/5"
          },
          {
            name: "India",
            flag: "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381895.png",
            score: "181/6",
            fullScore: "181/6 (19.5/20 ov, T:181)"
          }
        ],
        result: "India won by 4 wickets (with 1 ball remaining)"
      }
    ]
  };

  const sampleMatch = sampleSeries.matches[0];
  const team1 = sampleMatch.teams[0] || { name: 'Team A', score: '150/4', flag: '' };
  const team2 = sampleMatch.teams[1] || { name: 'Team B', score: '152/2', flag: '' };

  const jsonSnippet = JSON.stringify([sampleSeries], null, 2);

  // Syntax highlight JSON helper
  function syntaxHighlight(json) {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'color: #9cdcfe;'; // number / default
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'color: #79c0ff; font-weight: 600;'; // key
        } else {
          cls = 'color: #a5d6ff;'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'color: #ff7b72;'; // boolean
      } else if (/null/.test(match)) {
        cls = 'color: #8b949e;'; // null
      }
      return '<span style="' + cls + '">' + match + '</span>';
    });
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0a0c10 100%);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #e6edf3;
    }
    .window {
      width: 1100px;
      background: #0d1117;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 139, 253, 0.15);
      overflow: hidden;
    }
    .titlebar {
      background: #161b22;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .dots { display: flex; gap: 8px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot.red { background: #ff5f56; }
    .dot.yellow { background: #ffbd2e; }
    .dot.green { background: #27c93f; }
    .urlbar {
      flex: 1;
      background: #0d1117;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .method {
      background: #238636;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
    }
    .url { color: #58a6ff; }
    .status-badge {
      background: rgba(46, 160, 67, 0.15);
      color: #3fb950;
      border: 1px solid rgba(46, 160, 67, 0.4);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .speed-badge {
      background: rgba(56, 139, 253, 0.15);
      color: #58a6ff;
      border: 1px solid rgba(56, 139, 253, 0.4);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .content {
      display: grid;
      grid-template-columns: 1fr 1.15fr;
      min-height: 520px;
    }
    .left-panel {
      padding: 28px;
      background: #0d1117;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .panel-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8b949e;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .match-card {
      background: #161b22;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      position: relative;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .series-name {
      font-size: 12px;
      font-weight: 600;
      color: #f0883e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .match-info {
      font-size: 12px;
      color: #8b949e;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .live-tag {
      position: absolute;
      top: 18px;
      right: 18px;
      background: #da3633;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .team-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .team-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .team-flag {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      background: #21262d;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .team-name {
      font-weight: 600;
      font-size: 15px;
      color: #e6edf3;
    }
    .team-score {
      font-weight: 700;
      font-size: 15px;
      color: #ffffff;
      text-align: right;
    }
    .match-result {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed rgba(255, 255, 255, 0.1);
      font-size: 13px;
      font-weight: 600;
      color: #3fb950;
    }
    .features-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: auto;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #c9d1d9;
    }
    .feature-icon {
      color: #238636;
      font-weight: bold;
    }
    .right-panel {
      padding: 24px;
      background: #0a0d12;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      line-height: 1.6;
      color: #e6edf3;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="dots">
        <div class="dot red"></div>
        <div class="dot yellow"></div>
        <div class="dot green"></div>
      </div>
      <div class="urlbar">
        <span class="method">GET</span>
        <span class="url">https://cricket-api-nu.vercel.app/getLive</span>
      </div>
      <div class="status-badge">
        <span>●</span> 200 OK
      </div>
      <div class="speed-badge">
        ⚡ 412ms
      </div>
    </div>
    <div class="content">
      <div class="left-panel">
        <div class="panel-title">Visual Match Preview</div>
        <div class="match-card">
          <div class="series-name">${sampleSeries.series}</div>
          <div class="match-info">${sampleMatch.matchInfo}</div>
          <div class="live-tag">${sampleMatch.status || 'LIVE'}</div>
          
          <div class="team-row">
            <div class="team-info">
              <img class="team-flag" src="${team1.flag}" onerror="this.style.display='none'">
              <span class="team-name">${team1.name}</span>
            </div>
            <span class="team-score">${team1.fullScore || team1.score || 'Yet to bat'}</span>
          </div>

          <div class="team-row">
            <div class="team-info">
              <img class="team-flag" src="${team2.flag}" onerror="this.style.display='none'">
              <span class="team-name">${team2.name}</span>
            </div>
            <span class="team-score">${team2.fullScore || team2.score || 'Yet to bat'}</span>
          </div>

          ${sampleMatch.result ? `<div class="match-result">${sampleMatch.result}</div>` : ''}
        </div>

        <div class="features-list">
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Real-time live scores, overs, run rates & targets</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Dynamic CDN team flags with automatic resolution</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Ultra-fast SSR response (< 500ms latency)</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Vercel Serverless Function & Edge-ready architecture</span>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="panel-title" style="margin-bottom: 14px;">Real-Time JSON Response</div>
        <pre>${syntaxHighlight(jsonSnippet.slice(0, 1600) + '\\n  ...')}
</pre>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const previewHtmlPath = path.join(assetsDir, 'preview_template.html');
  fs.writeFileSync(previewHtmlPath, html, 'utf8');

  // Launch browser and screenshot
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 740, deviceScaleFactor: 2 });
  await page.goto('file://' + previewHtmlPath, { waitUntil: 'networkidle0' });

  // Wait a moment for web fonts and images
  await new Promise(r => setTimeout(r, 1000));

  const screenshotPath = path.join(assetsDir, 'preview.png');
  await page.screenshot({
    path: screenshotPath,
    clip: { x: 50, y: 30, width: 1100, height: 680 }
  });

  console.log('Successfully generated preview screenshot at:', screenshotPath);
  await browser.close();

  // Clean up temporary template
  fs.unlinkSync(previewHtmlPath);
}

generate().catch(err => {
  console.error('Error generating screenshot:', err);
  process.exit(1);
});
