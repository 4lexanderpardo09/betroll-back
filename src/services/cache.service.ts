import { Injectable } from '@nestjs/common';

export interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
}

@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;

  // TTL constants in milliseconds
  static readonly TTL = {
    MATCH_STATS: 60 * 60 * 1000, // 1 hour for match statistics
    MATCH_PREVIOUS: 7 * 24 * 60 * 60 * 1000, // 7 days for past match stats
    STANDINGS: 24 * 60 * 60 * 1000, // 24 hours for standings
    INJURIES: 6 * 60 * 60 * 1000, // 6 hours for injury reports
    NEWS: 2 * 60 * 60 * 1000, // 2 hours for news
    ODDS_PRE_MATCH: 15 * 60 * 1000, // 15 minutes for pre-match odds
    ODDS_LIVE: 60 * 1000, // 1 minute for live odds
    TEAM_FORM: 6 * 60 * 60 * 1000, // 6 hours for team form
    SCHEDULE: 60 * 60 * 1000, // 1 hour for schedules
    ROSTER: 24 * 60 * 60 * 1000, // 24 hours for roster data
    ATHLETE: 60 * 60 * 1000, // 1 hour for athlete data
    SEARCH: 15 * 60 * 1000, // 15 minutes for search results
  };

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const defaultTTL = 5 * 60 * 1000; // 5 minutes default
    const expiresAt = new Date(Date.now() + (ttlMs || defaultTTL));

    this.cache.set(key, {
      data,
      expiresAt,
    });
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, ttlMs);
    return data;
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate.toFixed(1)}%`,
    };
  }

  // Helper to build cache keys
  static buildKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}
