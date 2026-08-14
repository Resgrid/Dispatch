import { storage } from '@/lib/storage';

import { getCacheScopeKey } from './cache-scope';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private getCacheKey(endpoint: string, params?: Record<string, unknown>): string {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    // Scope by the signed-in identity so a second user (or a department switch) on the same device
    // is never served the previous account's rosters, units or contacts out of MMKV.
    return `api_cache_${getCacheScopeKey()}_${endpoint}${queryString}`;
  }

  private isExpired(timestamp: number, expiresIn: number): boolean {
    return Date.now() - timestamp > expiresIn;
  }

  set<T>(endpoint: string, data: T, params?: Record<string, unknown>, ttl: number = this.defaultTTL): void {
    const key = this.getCacheKey(endpoint, params);
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresIn: ttl,
    };
    storage.set(key, JSON.stringify(cacheItem));
  }

  get<T>(endpoint: string, params?: Record<string, unknown>): T | null {
    const key = this.getCacheKey(endpoint, params);
    const cached = storage.getString(key);

    if (!cached) {
      return null;
    }

    const cacheItem: CacheItem<T> = JSON.parse(cached);

    if (this.isExpired(cacheItem.timestamp, cacheItem.expiresIn)) {
      storage.delete(key);
      return null;
    }

    return cacheItem.data;
  }

  remove(endpoint: string, params?: Record<string, unknown>): void {
    const key = this.getCacheKey(endpoint, params);
    storage.delete(key);
  }

  clear(): void {
    const allKeys = storage.getAllKeys();
    allKeys.forEach((key) => {
      if (key.startsWith('api_cache_')) {
        storage.delete(key);
      }
    });
  }
}

export const cacheManager = CacheManager.getInstance();
