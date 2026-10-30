# Cricket API & Scraper 🏏

A high-performance, resilient REST API and web scraper for real-time cricket data, live match scores, fixtures, tournament schedules, points tables, player profiles, ball-by-ball commentary, match analytics (Partnerships, FOW, DRS, Manhattan, Worm), Cricbuzz photo galleries, ICC rankings, and detailed innings scorecards.

![Cricket API Live Preview](assets/preview.png)

---

## 📱 Frontend Companion: CricGeek UI

This backend powers **[CricGeek](https://github.com/Abhip32/CricGeek)** — a luxury sports web platform inspired by athletic editorial styling (bold high-contrast typography, athletic crimson red `#DC2626` / pure white theme, freely-rendering flags, and zero auto-polling overhead).  
🌐 **Live Web Application**: [https://cric-geek.vercel.app](https://cric-geek.vercel.app)

### 📸 Application Views & Showcase

| Home Dashboard | Live Match Center | Completed Fixtures & Results |
|:---:|:---:|:---:|
| ![Home Dashboard](assets/a-home.png) | ![Live Match Center](assets/matches.png) | ![Recent Results](assets/matches-recent.png) |

| Innings Scorecard & Analytics | MVP & Player Impact Leaderboard | Ball-by-Ball Commentary & Over Timeline |
|:---:|:---:|:---:|
| ![Interactive Scorecard](assets/scorecard.png) | ![MVP & Impact](assets/scorecard-mvp.png) | ![Commentary](assets/scorecard-commentary.png) |

| Match Info & Playing XI | Tournament Schedule & Fixtures | Official ICC Leaderboards |
|:---:|:---:|:---:|
| ![Match Info & Squads](assets/scorecard-info.png) | ![Tournament Schedule](assets/schedule.png) | ![ICC Rankings](assets/rankings.png) |

| Cricbuzz High-Res Photo Galleries | ICC Player Rankings | Upcoming Fixtures (ESPN Powered) |
|:---:|:---:|:---:|
| ![Photo Galleries](assets/photos.png) | ![Player Rankings](assets/rankings-players.png) | ![Upcoming Matches](assets/matches-upcoming.png) |

---

## ⚡ Key Architecture & Core Capabilities

1. **Player Search & Detailed Player Profiles (`/player/search`, `/player/:id`)**:
   - Ultra-fast player lookup by name with verified athlete IDs and country affiliations.
   - Rich player bio endpoints extracting date of birth, age, batting style, bowling style, playing role, official 500x500 CDN team crest, and verified high-resolution headshots.

2. **Tournament Standings & Points Tables (`/getStandings`, `/getSeries`)**:
   - Live tournament discovery listing all active bilateral tours and domestic leagues.
   - Comprehensive points tables with ranks, points, wins, losses, ties, NRR, and official team logos across IPL, BBL, Sheffield Shield, World Cups, and more.

3. **In-Depth Match Analytics & Visual Charts**:
   - **Partnerships (`/match/partnerships`)**: Wicket-by-wicket partnership analysis with runs, overs, run rates, and individual player contributions with headshots.
   - **Fall of Wickets (`/match/fow`)**: Exact over-by-over dismissal timeline with batter scores and dismissal types.
   - **DRS Review Tracker (`/match/drs`)**: Review quotas (permitted, remaining, successful, unsuccessful) and live challenge logs.
   - **Manhattan Chart (`/match/manhattan`)**: Over-by-over runs and wickets data ready for frontend bar charts.
   - **Worm Chart (`/match/worm`)**: Cumulative run trajectory comparing both innings over by over.

4. **Match Preview, Pitch Report & Playing XI (`/match/preview`, `/match/squads`, `/match/info`)**:
   - Pre-match pitch reports and captain toss quotes extracted from live expert commentary feeds.
   - Playing XI (starters), bench/substitutes, captains, wicketkeepers, and match debutants.
   - Stadium venue information (capacity, surface type, city, country) and match officials (umpires, referee with flags).

5. **Direct ESPN News Integration (`/getNews`, `/news`)**:
   - Upgraded to ESPN's official 50-article JSON feed with high-res 900x506 CDN imagery, bylines, published timestamps, and topic categories.
   - Supports tournament-specific news via `?leagueId=...` with resilient RSS XML and HTML scraping fallbacks.

6. **100% ESPN API-Powered Live, Recent & Upcoming Fixtures (`/getLive`, `/getRecent`, `/getUpcoming`)**:
   - Direct integration into ESPN's official Scoreboard Header API (`< 100ms`).
   - Immune to Akamai 403 blocks on serverless cloud functions with support for `?league=...`, `?group=international`, and `?region=...` filters.

7. **Ball-by-Ball Commentary Stream with Video Replays (`/getCommentary`)**:
   - Paginated ball-by-ball stream (`&limit=100`, `&page=N`, `&period=N`) with delivery outcomes (`W`, `4`, `6`, `1`, `0`), bowler/batter matchups, and direct video clip replay links (`videoClipUrl`).

8. **Dynamic Team Flags & Multi-Tier In-Memory Cache (`flagService.js`, `cacheService.js`)**:
   - Resolves SVG placeholders into high-resolution badges across 190+ countries and domestic clubs.
   - High-performance LRU memory cache responding in **< 5 milliseconds**.

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

# Development mode with nodemon live reload
npm run dev

# Re-generate documentation preview screenshot
npm run screenshot
```

The API will be available at `http://localhost:8000`.

---

## ☁️ Vercel Serverless Deployment

This project is optimized for deployment as a Vercel Serverless Function:
- **Serverless Chromium**: Automatically switches to [`@sparticuz/chromium-min`](https://github.com/Sparticuz/chromium) and `puppeteer-core` in serverless environments (`VERCEL=1`), fitting cleanly within Vercel's function zip limits without missing shared C++ libraries.
- **Local Fallback**: Automatically discovers local Chrome / Edge installations when running on local development machines.
- **Extended Timeout**: Configured with `maxDuration: 60` and `memory: 1024` in [`vercel.json`](vercel.json) to ensure headless browser launches and page parsing finish comfortably.

---

## 📖 API Documentation & Endpoints

### 1. System & Catalog

#### `GET /`
- **Description**: Returns live API status, version, and an interactive catalog of all available endpoints and parameters.

#### `GET /health`
- **Description**: Lightweight health probe returning `{ status: 'ok', timestamp: '...' }` for uptime monitors.

#### `GET /team-flags`
- **Parameters**: `team` *(optional, e.g. `?team=India` or `?team=NZ`)*
- **Description**: Returns dynamically resolved cricket team logos and flags dictionary.

---

### 2. Player Endpoints

#### `GET /player/search`
- **Cache TTL**: 15 minutes
- **Parameters**:
  - `query` *(required)*: Cricketer search query (e.g. `?query=Kohli` or `?query=Bumrah`).
  - `limit` *(optional, default 10, max 25)*: Number of results.
- **Response**: Array of matching cricketers with player ID, full name, country/team, cricinfo link, and high-resolution headshot CDN URL (`https://a.espncdn.com/i/headshots/cricket/players/full/:id.png`).

#### `GET /player/:id` or `GET /getPlayer`
- **Cache TTL**: 1 hour
- **Parameters**:
  - `id` *(required in path `/player/:id` or query `?id=253802`)*: Numeric athlete ID.
- **Response**: Complete athlete profile including `dateOfBirth`, `age`, `gender`, `position` (role), `battingStyle`, `bowlingStyle`, national team details with official hex color and 500x500 CDN crest, and verified headshot image.

#### `GET /search` (Universal Search)
- **Cache TTL**: 10 minutes
- **Parameters**:
  - `query` *(required, e.g. `?query=Australia` or `?query=Mumbai+Indians`)*
  - `type` *(optional: `player`, `team`, `league`, `series`, `article`, `clips`)*
  - `limit` *(optional, default 10)*
- **Response**: Structured search results grouped by category across cricketers, franchise & national teams, tournament series, news stories, and video replays.

---

### 3. Tournaments, Series & Standings

#### `GET /getSeries` or `GET /series`, `GET /getTournaments`
- **Cache TTL**: 10 minutes
- **Parameters**: `refresh=true` *(optional)*
- **Response**: List of all currently active tournaments and series with `id` (`leagueId`), `name`, `slug`, `isTournament`, `season`, `eventsCount`, and active match snapshots.

#### `GET /getStandings` or `GET /standings`, `GET /series/:leagueId/standings`
- **Cache TTL**: 5 minutes
- **Parameters**:
  - `leagueId` *(required, e.g. `?leagueId=8043` for Sheffield Shield or `?leagueId=21284` for WBBL)*.
  - `refresh=true` *(optional)*
- **Response**: Official tournament points table sorted by rank, with team names, abbreviations, 500x500 CDN logos, match points, and full statistics.

#### `GET /getSeriesTeams` or `GET /series/:leagueId/teams`
- **Cache TTL**: 15 minutes
- **Parameters**:
  - `leagueId` *(required, e.g. `?leagueId=8043`)*
- **Response**: All participating teams in the specified tournament with names, abbreviations, location, and official logos.

---

### 4. Matches & Fixtures

#### `GET /getLive`
- **Cache TTL**: 45 seconds
- **Parameters**:
  - `league` *(optional, filter by tournament ID, e.g. `?league=8048`)*
  - `group` *(optional, e.g. `?group=international`)*
  - `region` *(optional, e.g. `?region=in`)*
  - `refresh=true` *(optional)*
- **Response**: Array of current live matches with scores, overs, run rates, targets, series, match status, and dynamic team flags.

#### `GET /getRecent`
- **Cache TTL**: 5 minutes
- **Parameters**:
  - `league`, `group`, `region` *(optional)*
  - `refresh=true` *(optional)*
- **Response**: Recently completed matches grouped by series with final results, scores, and dynamic team flags.

#### `GET /getUpcoming`
- **Cache TTL**: 10 minutes
- **Parameters**:
  - `date` *(optional, YYYYMMDD format, e.g. `?date=20261101`)*
  - `category` *(optional: `international`, `domestic`, `league`)*
  - `format` *(optional: `TEST`, `ODI`, `T20`)*
  - `league`, `group`, `region` *(optional)*
  - `refresh=true` *(optional)*
- **Response**: Upcoming scheduled fixtures with full team details, flags, series titles, venue information, start timestamps, and match formats.

#### `GET /getSchedule`
- **Alias**: `GET /getschdule`
- **Cache TTL**: 10 minutes
- **Parameters**: `refresh=true` *(optional)*
- **Response**: Comprehensive tournament schedules, series fixtures, venue information, and match timings.

---

### 5. Detailed Scorecard & In-Match Analytics

#### `GET /getScorecard` or `GET /scorecard`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**:
  - `url` *(optional, e.g. `?url=https://www.espncricinfo.com/series/...`)*. Defaults to the latest active match if omitted.
  - `leagueId` & `eventId` *(optional, direct IDs, e.g. `?leagueId=24756&eventId=1553295`)*
  - `refresh=true` *(optional)*
- **Response**: Full match scorecard including batting tables (R, B, 4s, 6s, SR, dismissal), bowling tables (O, M, R, W, ECON), fall of wickets, wicket-by-wicket partnerships, DRS reviews, Playing XI squads, toss, venue, officials, leaders, and match status.

#### `GET /match/partnerships` or `GET /getPartnerships`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Complete wicket-by-wicket partnership analysis for every innings with total runs, balls, duration in overs, partnership run rate, start/end scores, and individual batsman contributions with headshots.

#### `GET /match/fow` or `GET /getFow`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Fall of Wickets (FOW) timeline for each innings with exact wicket over, team score, batsman runs, balls faced, dismissal type, and player headshot image.

#### `GET /match/drs` or `GET /getDrs`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Review statistics per team and innings (`reviewsPermitted`, `remaining`, `successful`, `unsuccessful`) along with the complete historical log of all DRS challenges.

#### `GET /match/squads` or `GET /getSquads`
- **Cache TTL**: 15 minutes
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Playing XI (`starters`), bench/substitutes, captains, wicketkeepers, and match debutants with verified headshots.

#### `GET /match/info` or `GET /getMatchInfo`
- **Cache TTL**: 15 minutes
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Match details including Toss decision, match number, match days, session timings, stadium venue (city, country, capacity, surface type), and match officials (umpires, referee with flags).

#### `GET /match/preview` or `GET /getMatchPreview`
- **Cache TTL**: 30 minutes
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: On-field Pitch Report, captain toss quotes, and tactical team setup narrative from expert commentators.

#### `GET /match/manhattan` or `GET /getManhattan`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Over-by-over runs scored, wickets fallen, bowler names, and cumulative score for each innings ready to plot a Manhattan bar chart.

#### `GET /match/worm` or `GET /getWorm`
- **Cache TTL**: 45 seconds (live) / 30 minutes (completed)
- **Parameters**: `leagueId` & `eventId` *(or `url`)*
- **Response**: Cumulative score progression curves across overs comparing both innings for plotting a Worm chart.

#### `GET /getCommentary` or `GET /commentary`
- **Cache TTL**: 30 seconds
- **Parameters**:
  - `leagueId` & `eventId` *(or `url`)*
  - `limit` *(optional, 1-300, default 100)*: Number of balls to return per page.
  - `page` *(optional, default 1)*: Page number for infinite scroll.
  - `period` *(optional, 1, 2, 3, 4)*: Filter by innings.
- **Response**: Ball-by-ball commentary stream with ball outcomes (`W`, `4`, `6`, `1`, `0`), bowler and batter live stats, dismissal notes, pre-ball narrative, and direct video clip replay links (`videoClipUrl`).

---

### 6. News, Media & Rankings

#### `GET /getNews` or `GET /news`
- **Cache TTL**: 10 minutes
- **Parameters**:
  - `leagueId` *(optional, e.g. `?leagueId=8048` for IPL news, default `0` for global news)*
  - `refresh=true` *(optional)*
- **Response**: Latest 50 cricket articles directly from ESPN with titles, descriptions, authors, publication timestamps, high-res 900x506 images, categories, and article links.

#### `GET /getPhotos`
- **Cache TTL**: 15 minutes
- **Parameters**: `id` *(optional album ID, e.g. `?id=2405`)*
- **Response**: High-resolution cricket photo albums from Cricbuzz (`750x422`) with captions and photo credits.

#### `GET /rankings/icc-team-ranking` or `GET /getTeamRankings`
- **Cache TTL**: 1 hour
- **Response**: Official Men's and Women's ICC rankings for Test, ODI, and T20 teams with ratings, points, and dynamic logos.

#### `GET /rankings/icc-player-ranking` or `GET /getBattingRankings`, `/getBowlingRankings`, `/getAllRounderRankings`
- **Cache TTL**: 1 hour
- **Response**: Official ICC player rankings across Batting, Bowling, and All-rounders in Test, ODI, and T20 formats with player names, ratings, and nationalities.

---

## 📁 Project Structure

```
Cricket-Api/
├── assets/                       # High-resolution screenshots & preview assets
├── controller/
│   ├── MatchDataController.js    # Live, Recent, Upcoming (ESPN API), & Schedule
│   ├── newsController.js         # Direct ESPN News API & fallback scraper
│   ├── photoController.js        # Cricbuzz photo galleries & albums
│   ├── playerController.js       # Player profiles, search & universal search
│   ├── rankingController.js      # ICC team & player rankings
│   ├── scoreCardController.js    # Scorecards, Commentary, Partnerships, FOW, DRS, Charts
│   └── seriesController.js       # Tournaments, series & standings (points tables)
├── routes/
│   ├── MatchDataRoute.js         # /getLive, /getRecent, /getUpcoming, /getSchedule
│   ├── newsRoute.js              # /getNews, /news
│   ├── photoRoute.js             # /getPhotos
│   ├── playerRoute.js            # /player/search, /player/:id, /search
│   ├── rankingRoutes.js          # /rankings/*
│   ├── ScoreCardRoute.js         # /getScorecard, /match/*, /getCommentary
│   └── seriesRoute.js            # /getSeries, /getStandings, /series/*
├── services/
│   ├── browserService.js         # Puppeteer lifecycle & ad/media blocker
│   ├── cacheService.js           # Multi-tier TTL cache with LRU eviction
│   └── flagService.js            # Dynamic team flag learning & resolution
├── scripts/
│   └── generate_screenshot.js    # Generates preview.png asset
├── index.js                      # Main Express server & API catalog
├── vercel.json                   # Serverless deployment configuration
└── package.json                  # Dependencies & scripts
```

---

## 👨‍💻 Author

Created & Maintained by **[Abhip32](https://github.com/Abhip32)**
