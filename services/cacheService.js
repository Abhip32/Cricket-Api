/**
 * In-memory cache service with TTL and auto-cleanup.
 */
class CacheService {
  constructor(maxSize = 200, defaultTtlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;

    // Periodic cleanup every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  isBypassed(req) {
    if (!req || !req.query) return false;
    const { refresh, nocache } = req.query;
    return refresh === 'true' || refresh === '1' || nocache === 'true' || nocache === '1';
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data, ttlMs = this.defaultTtlMs) {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      cachedAt: new Date().toISOString()
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = new CacheService();
