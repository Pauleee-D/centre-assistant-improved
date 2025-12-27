// Simple in-memory cache for API query results
// Cache key format: "{model}:{centre}:{question}"

interface CacheEntry {
  answer: string;
  sources: Array<{url: string, title: string}>;
  timestamp: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxAge: number = 1000 * 60 * 60; // 1 hour default

  constructor(maxAgeMs?: number) {
    if (maxAgeMs) {
      this.maxAge = maxAgeMs;
    }
  }

  // Generate cache key from query parameters
  private generateKey(model: string, centre: string, question: string): string {
    return `${model}:${centre}:${question.toLowerCase().trim()}`;
  }

  // Get cached result if exists and not expired
  get(model: string, centre: string, question: string): CacheEntry | null {
    const key = this.generateKey(model, centre, question);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  // Store result in cache
  set(model: string, centre: string, question: string, answer: string, sources: Array<{url: string, title: string}>): void {
    const key = this.generateKey(model, centre, question);
    this.cache.set(key, {
      answer,
      sources,
      timestamp: Date.now(),
    });
  }

  // Clear all cache entries
  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export a singleton instance
export const queryCache = new QueryCache();
