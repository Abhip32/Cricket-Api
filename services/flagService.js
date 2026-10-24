const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Fallback generic cricket logo CDN
const DEFAULT_FLAG = 'https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381853.png';

// Common abbreviation to full name mapping
const COMMON_ALIASES = {
  'ind': 'India',
  'india': 'India',
  'nz': 'New Zealand',
  'new zealand': 'New Zealand',
  'aus': 'Australia',
  'australia': 'Australia',
  'eng': 'England',
  'england': 'England',
  'sa': 'South Africa',
  'south africa': 'South Africa',
  'pak': 'Pakistan',
  'pakistan': 'Pakistan',
  'wi': 'West Indies',
  'west indies': 'West Indies',
  'sl': 'Sri Lanka',
  'sri lanka': 'Sri Lanka',
  'afg': 'Afghanistan',
  'afghanistan': 'Afghanistan',
  'ban': 'Bangladesh',
  'bangladesh': 'Bangladesh',
  'zim': 'Zimbabwe',
  'zimbabwe': 'Zimbabwe',
  'ire': 'Ireland',
  'ireland': 'Ireland',
  'sco': 'Scotland',
  'scotland': 'Scotland',
  'ned': 'Netherlands',
  'netherlands': 'Netherlands',
  'uae': 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  'usa': 'United States of America',
  'united states of america': 'United States of America',
  'nam': 'Namibia',
  'namibia': 'Namibia',
  'nep': 'Nepal',
  'nepal': 'Nepal',
  'oma': 'Oman',
  'oman': 'Oman',
  'png': 'Papua New Guinea',
  'papua new guinea': 'Papua New Guinea',
  'uga': 'Uganda',
  'uganda': 'Uganda',
  'moz': 'Mozambique',
  'mozambique': 'Mozambique'
};

class FlagService {
  constructor() {
    this.flagsMap = new Map();
    this.isSyncing = false;
    this.lastSync = null;

    // 1. Cold start bootstrap from local team_flags.json if present
    this.bootstrapFromLocalFile();
  }

  normalizeKey(name) {
    if (!name) return '';
    return String(name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  bootstrapFromLocalFile() {
    try {
      const localFile = path.join(__dirname, '..', 'team_flags.json');
      if (fs.existsSync(localFile)) {
        const raw = fs.readFileSync(localFile, 'utf8');
        const json = JSON.parse(raw);
        for (const [team, url] of Object.entries(json)) {
          if (url && typeof url === 'string' && !url.includes('lazyimage') && !url.includes('.svg')) {
            this.registerFlag(team, url);
          }
        }
        console.log(`FlagService: Bootstrapped ${this.flagsMap.size} flags from team_flags.json`);
      }
    } catch (err) {
      console.warn('FlagService: Failed to bootstrap local flags:', err.message);
    }
  }

  /**
   * Registers a team name and flag URL into the dynamic in-memory registry.
   */
  registerFlag(teamName, flagUrl) {
    if (!teamName || !flagUrl || typeof flagUrl !== 'string') return;

    let cleanUrl = flagUrl.trim();
    if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('data:')) {
      cleanUrl = `https://www.espncricinfo.com${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
    }

    // Never register lazy load placeholders or generic SVG icons
    if (cleanUrl.includes('lazyimage') || cleanUrl.endsWith('.svg') || cleanUrl.startsWith('data:')) {
      return;
    }

    const key = this.normalizeKey(teamName);
    if (key) {
      this.flagsMap.set(key, cleanUrl);
    }

    // Also register under common alias
    const alias = COMMON_ALIASES[teamName.toLowerCase().trim()];
    if (alias) {
      const aliasKey = this.normalizeKey(alias);
      if (!this.flagsMap.has(aliasKey)) {
        this.flagsMap.set(aliasKey, cleanUrl);
      }
    }
  }

  /**
   * Gets the flag URL for a team name dynamically from registry, aliases, or fuzzy match.
   */
  getFlag(teamName) {
    if (!teamName) return DEFAULT_FLAG;

    const key = this.normalizeKey(teamName);
    if (this.flagsMap.has(key)) {
      return this.flagsMap.get(key);
    }

    // Check alias mapping
    const alias = COMMON_ALIASES[teamName.toLowerCase().trim()];
    if (alias) {
      const aliasKey = this.normalizeKey(alias);
      if (this.flagsMap.has(aliasKey)) {
        return this.flagsMap.get(aliasKey);
      }
    }

    // Fuzzy match: e.g. "India Women" -> "India"
    for (const [k, url] of this.flagsMap.entries()) {
      if (k.length >= 4 && (key.includes(k) || k.includes(key))) {
        return url;
      }
    }

    return DEFAULT_FLAG;
  }

  /**
   * Dynamically extracts a flag from a Cheerio DOM element.
   * Checks img src, data-src, srcset, handles lazy loaders, and falls back to dynamic registry.
   */
  extractFlagFromElement($, element, teamName = '') {
    const $el = $(element);
    const img = $el.is('img') ? $el : $el.find('img').first();

    let flagUrl = null;

    if (img.length) {
      const src = img.attr('src');
      const dataSrc = img.attr('data-src') || img.attr('data-original-src');
      const srcset = img.attr('srcset');

      let candidate = src || dataSrc;
      if (!candidate && srcset) {
        candidate = srcset.split(',')[0].trim().split(' ')[0];
      }

      if (candidate && !candidate.includes('lazyimage') && !candidate.endsWith('.svg') && !candidate.startsWith('data:')) {
        flagUrl = candidate.trim();
        if (!flagUrl.startsWith('http')) {
          flagUrl = `https://www.espncricinfo.com${flagUrl.startsWith('/') ? '' : '/'}${flagUrl}`;
        }
      }

      // Learn from alt text
      const alt = img.attr('alt');
      if (alt && flagUrl) {
        const cleanAlt = alt.replace(/\s*flag\s*/i, '').trim();
        if (cleanAlt) this.registerFlag(cleanAlt, flagUrl);
      }
    }

    // Learn from title attribute
    const title = $el.attr('title') || $el.find('[title]').first().attr('title');
    if (title && flagUrl) {
      this.registerFlag(title, flagUrl);
    }

    if (teamName && flagUrl) {
      this.registerFlag(teamName, flagUrl);
    }

    // Fallback if element has lazy loader placeholder, shield icon, or no img
    if (!flagUrl) {
      flagUrl = this.getFlag(teamName || title);
    }

    return flagUrl;
  }

  /**
   * Fetches latest teams and flags directly from Cricinfo's team directory dynamically in the background.
   */
  async syncFromCricinfo(browserService) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      console.log('FlagService: Syncing team flags dynamically from Cricinfo...');
      const html = await browserService.fetchPageHtml('https://www.espncricinfo.com/team', {
        waitMs: 1200,
        scrollTriggerLazy: true // Smoothly scrolls to trigger all IntersectionObservers
      });
      const $ = cheerio.load(html);

      let count = 0;
      $('a[href*="/team/"]').each((i, el) => {
        const name = $(el).find('span, p').first().text().trim() || $(el).text().trim();
        const img = $(el).find('img');
        const flag = img.attr('src') || img.attr('data-src');

        if (name && flag && !flag.includes('lazyimage') && !flag.endsWith('.svg')) {
          this.registerFlag(name, flag);
          count++;
        }
      });

      this.lastSync = new Date().toISOString();
      console.log(`FlagService: Successfully synced ${count} team flags dynamically from Cricinfo.`);
    } catch (err) {
      console.warn('FlagService: Dynamic sync notice (using cached registry):', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns all currently registered flags as a dictionary
   */
  getAllFlags() {
    const obj = {};
    for (const [k, v] of this.flagsMap.entries()) {
      obj[k] = v;
    }
    return {
      count: this.flagsMap.size,
      lastSync: this.lastSync,
      flags: obj
    };
  }
}

module.exports = new FlagService();
