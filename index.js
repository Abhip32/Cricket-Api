const PORT=process.env.PORT || 8000;
const express = require('express');
const cors = require("cors");
const puppeteer = require('puppeteer');

// Advanced in-memory cache with cleanup
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum cache entries

// Cache middleware
function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  // Remove expired entries
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCachedData(key, data) {
  // Clean up old entries if cache is getting too large
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Periodic cache cleanup (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
  console.log(`Cache cleanup completed. Current cache size: ${cache.size}`);
}, 10 * 60 * 1000);

// Global browser instance - accessible by all controllers
let browserInstance = null;

// Initialize browser on server start with performance optimizations
const initBrowser = async () => {
  if (!browserInstance) {
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
        '--max_old_space_size=4096'
      ]
    });
  }
  return browserInstance;
};

// Get browser instance (for controllers to use)
const getBrowser = () => {
  if (!browserInstance) {
    throw new Error('Browser not initialized. Call initBrowser() first.');
  }
  return browserInstance;
};

// Cleanup function
const closeBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

// Make browser and cache functions globally available
global.getBrowser = getBrowser;
global.closeBrowser = closeBrowser;
global.getCachedData = getCachedData;
global.setCachedData = setCachedData;

const app = express();
app.use(cors());

// Initialize browser on server start
initBrowser().then(() => {
  console.log('Browser initialized successfully');
}).catch(err => {
  console.error('Failed to initialize browser:', err);
});

app.get('/',(req,res)=>{
    res.json("Cricket API Made by Abhip32!")
})


app.use(require("./routes/newsRoute"))
app.use(require("./routes/MatchDataRoute"));
app.use(require("./routes/rankingRoutes"));
app.use(require("./routes/ScoreCardRoute"));

const server = app.listen(PORT, ()=>console.log('listening on port :'+PORT));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeBrowser();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await closeBrowser();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
