# Cricket API & Scraper 🏏

A high-performance, resilient REST API and web scraper for real-time cricket data, scores, fixtures, news, ICC rankings, and detailed match scorecards.

---

## ⚡ What Was Fixed & Improved

1. **Dynamic Team Flags & Lazy-Loading Solution**:
   - Previously, team flags were read from a static 4-year-old JSON dump (`team_flags.json`) because ESPN Cricinfo uses lazy-loaded image placeholders (`lazyimage-noaspect.svg` / `transparent.png`).
   - Built a dynamic [`flagService.js`](file:///c:/Users/abhis/OneDrive/Desktop/Desktop/Cricket-Api/services/flagService.js) that:
     - Automatically learns and registers flags dynamically from live matches, scorecards, rankings, and match cards.
     - Performs automated background sync from Cricinfo's team directory, smooth-scrolling to resolve IntersectionObserver lazy-load placeholders into high-resolution CDN images.
     - Resolves team abbreviations (`IND`, `AUS`, `NZ`, `SA`, `ENG`, etc.) and fuzzy team name variations.
     - Adds structured `teamDetails` with dynamic flags to upcoming fixtures (`/getUpcoming`).
     - Exposes a new `/team-flags` endpoint to inspect or query flags by team name.
2. **Selector & Layout Fixes**:
   - Modernized all Tailwind CSS selectors from Cricinfo's legacy classes (e.g. `ds-font-bold` → `ds-font-medium`, `ds-table` → `ds-v2-table`).
   - Integrated Schema.org `application/ld+json` fallbacks for rock-solid parsing.
3. **Infinite Hang & Performance Overhaul**:
   - Removed unbounded `autoScroll` and `networkidle2: timeout: 0`.
   - Intercepts and blocks fonts, video, media, and tracking scripts, reducing latency from 30+ seconds down to **1.5–2.5 seconds**.
4. **Active Multi-Tier In-Memory Caching**:
   - Integrated automatic TTL caching across all endpoints with LRU cleanup.
   - Cache hits respond in **< 5 milliseconds**.
   - Added `?refresh=true` or `?nocache=true` support on all endpoints.
5. **Resilient Browser Service**:
   - Centralized in [`browserService.js`](file:///c:/Users/abhis/OneDrive/Desktop/Desktop/Cricket-Api/services/browserService.js) with auto-reconnection and cleanup in `finally` blocks.
6. **Scorecard URL Normalization**:
   - Accepts any Cricinfo match URL (commentary, preview, report) and automatically routes to `/full-scorecard`.
   - Resolves the latest active match dynamically if no URL is provided.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
# Production mode
npm start

# Development mode with live reload
npm run dev
```

The API will be available at `http://localhost:8000`.

---

## ☁️ Vercel Deployment

This project is optimized for deployment as a Vercel Serverless Function:
- **Serverless Chromium**: Automatically switches to [`@sparticuz/chromium-min`](https://github.com/Sparticuz/chromium) and `puppeteer-core` in serverless environments (`VERCEL=1`), fitting cleanly within Vercel's 50MB function zip limit without missing shared libraries.
- **Local Fallback**: Automatically discovers local Chrome / Edge installations when running on local development machines.
- **Extended Timeout**: Configured with `maxDuration: 60` and `memory: 1024` in [`vercel.json`](file:///c:/Users/abhis/OneDrive/Desktop/Desktop/Cricket-Api/vercel.json) to ensure headless browser launches and page parsing finish comfortably.
- **Ignored Assets**: Unnecessary heavy files (`.vercelignore`) are omitted from deployment bundles to keep serverless functions lightweight and fast.

---

## 📖 API Documentation

### 1. Root & Documentation
- **Endpoint**: `GET /`
- **Description**: Returns API status and interactive catalog of all available endpoints.

### 2. Health Check
- **Endpoint**: `GET /health`
- **Description**: Lightweight health probe for monitoring and uptime checkers.

### 3. Live Matches
- **Endpoint**: `GET /getLive`
- **Cache TTL**: 45 seconds
- **Parameters**: `refresh=true` *(optional)*
- **Response**: Live match cards with scores, overs, run rates, targets, and dynamic flags.

### 4. Recent Matches
- **Endpoint**: `GET /getRecent`
- **Cache TTL**: 5 minutes
- **Parameters**: `refresh=true` *(optional)*
- **Response**: Completed matches with results and dynamic flags.

### 5. Upcoming Matches & Fixtures
- **Endpoint**: `GET /getUpcoming`
- **Cache TTL**: 10 minutes
- **Parameters**:
  - `date` *(optional)*: Filter in `DD-MM-YYYY` or `YYYY-MM-DD` (e.g., `?date=2026-10-25`).
  - `refresh=true` *(optional)*
- **Response**: Upcoming fixtures with `teams`, `teamDetails` (name + dynamic flag), venue, series, and match time.

### 6. Cricket News
- **Endpoint**: `GET /getNews`
- **Cache TTL**: 10 minutes
- **Parameters**: `refresh=true` *(optional)*
- **Response**: Latest cricket news with title, description, author, publication date, image, and article link.

### 7. ICC Team Rankings
- **Endpoint**: `GET /rankings/icc-team-ranking`
- **Cache TTL**: 1 hour
- **Response**: Men's and Women's ICC rankings for Test, ODI, and T20 teams with logos.

### 8. ICC Player Rankings
- **Endpoint**: `GET /rankings/icc-player-ranking`
- **Cache TTL**: 1 hour
- **Response**: ICC rankings for Batting, Bowling, and All-rounders across Test, ODI, and T20.

### 9. Full Match Scorecard
- **Endpoint**: `GET /getScorecard`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**:
  - `url` *(optional)*: Match scorecard URL. Defaults to the latest active match.
  - `refresh=true` *(optional)*
- **Response**: Innings batting & bowling tables, fall of wickets, team scores, and summary.

### 10. Team Flags Directory
- **Endpoint**: `GET /team-flags`
- **Parameters**:
  - `team` *(optional)*: Query flag for a specific team (e.g. `?team=India` or `?team=NZ`).
- **Response**: Dynamically resolved flag URLs.

---

## 📁 Project Structure

```
Cricket-Api/
├── controller/
│   ├── MatchDataController.js    # Live, Recent, and Upcoming matches
│   ├── newsController.js         # Cricket news extraction
│   ├── rankingController.js      # ICC team & player rankings
│   └── scoreCardController.js    # Full match scorecards
├── routes/
│   ├── MatchDataRoute.js         # /getLive, /getRecent, /getUpcoming
│   ├── newsRoute.js              # /getNews
│   ├── rankingRoutes.js          # /rankings/*
│   └── ScoreCardRoute.js         # /getScorecard
├── services/
│   ├── browserService.js         # Shared Puppeteer instance & optimization
│   ├── cacheService.js           # Multi-tier TTL cache with LRU eviction
│   └── flagService.js            # Dynamic team flag learning & resolution
├── index.js                      # Main Express server & API catalog
└── package.json                  # Dependencies & scripts
```
