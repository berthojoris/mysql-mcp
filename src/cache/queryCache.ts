import crypto from "crypto";

/**
 * Cache entry interface
 */
export interface CacheEntry {
  data: any;
  timestamp: number;
  hitCount: number;
  queryHash: string;
  sql: string;
  params?: any[];
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  currentSize: number;
  maxSize: number;
  ttlMs: number;
  enabled: boolean;
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  enabled: boolean;
  ttlMs: number; // Time-to-live in milliseconds (default: 60000 = 1 minute)
  maxSize: number; // Maximum number of cached entries (default: 100)
  maxMemoryMB: number; // Maximum memory usage in MB (default: 50)
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  enabled: false, // Opt in with CACHE_ENABLED=true; writes by other clients are not detected
  ttlMs: 60000, // 1 minute default TTL
  maxSize: 100, // Maximum 100 cached queries
  maxMemoryMB: 50, // Maximum 50MB memory usage
};

/**
 * LRU Query Cache with TTL support
 * Implements an in-memory cache for query results to improve performance
 */
export class QueryCache {
  private static instance: QueryCache;
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: {
    totalHits: number;
    totalMisses: number;
  };
  private accessOrder: string[]; // Track access order for LRU eviction

  private constructor() {
    this.cache = new Map();
    this.config = { ...DEFAULT_CONFIG };
    this.stats = { totalHits: 0, totalMisses: 0 };
    this.accessOrder = [];

    // Load config from environment if available
    this.loadConfigFromEnv();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache();
    }
    return QueryCache.instance;
  }

  /**
   * Load cache configuration from environment variables
   */
  private loadConfigFromEnv(): void {
    if (process.env.CACHE_ENABLED !== undefined) {
      this.config.enabled = process.env.CACHE_ENABLED === "true";
    }
    if (process.env.CACHE_TTL_MS) {
      const ttl = parseInt(process.env.CACHE_TTL_MS, 10);
      if (!isNaN(ttl) && ttl > 0) {
        this.config.ttlMs = ttl;
      }
    }
    if (process.env.CACHE_MAX_SIZE) {
      const maxSize = parseInt(process.env.CACHE_MAX_SIZE, 10);
      if (!isNaN(maxSize) && maxSize > 0) {
        this.config.maxSize = maxSize;
      }
    }
    if (process.env.CACHE_MAX_MEMORY_MB) {
      const maxMemory = parseInt(process.env.CACHE_MAX_MEMORY_MB, 10);
      if (!isNaN(maxMemory) && maxMemory > 0) {
        this.config.maxMemoryMB = maxMemory;
      }
    }
  }

  /**
   * Generate a unique hash for a query and its parameters
   */
  private generateHash(sql: string, params?: any[]): string {
    const normalized = sql.trim().toLowerCase();
    let paramsStr = "";
    if (params) {
      try {
        paramsStr = JSON.stringify(params);
      } catch {
        // Handle circular references or non-serializable values
        paramsStr = params
          .map((p) => {
            if (p === null) return "null";
            if (p === undefined) return "undefined";
            if (typeof p === "object") {
              try {
                return JSON.stringify(p);
              } catch {
                return String(p);
              }
            }
            return String(p);
          })
          .join(",");
      }
    }
    const combined = `${normalized}:${paramsStr}`;
    return crypto.createHash("md5").update(combined).digest("hex");
  }

  /**
   * Check if a query result is cached and valid
   */
  public get(sql: string, params?: any[]): CacheEntry | null {
    if (!this.config.enabled) {
      return null;
    }

    const hash = this.generateHash(sql, params);
    const entry = this.cache.get(hash);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(hash);
      this.removeFromAccessOrder(hash);
      this.stats.totalMisses++;
      return null;
    }

    // Update hit count and access order
    entry.hitCount++;
    this.updateAccessOrder(hash);
    this.stats.totalHits++;

    // Return a deep copy to prevent mutation of cached data
    return {
      ...entry,
      data: JSON.parse(JSON.stringify(entry.data)),
    };
  }

  /**
   * Cache a query result
   */
  public set(sql: string, params: any[] | undefined, data: any): void {
    if (!this.config.enabled) {
      return;
    }

    // Only cache SELECT queries
    const normalizedSql = sql.trim().toUpperCase();
    if (!normalizedSql.startsWith("SELECT")) {
      return;
    }

    const hash = this.generateHash(sql, params);

    // Check if we need to evict entries
    this.evictIfNeeded();

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      hitCount: 0,
      queryHash: hash,
      sql,
      params,
    };

    this.cache.set(hash, entry);
    this.updateAccessOrder(hash);
  }

  /**
   * Invalidate cache entries matching a pattern
   * Used when data is modified (INSERT, UPDATE, DELETE)
   */
  public invalidate(pattern?: string | RegExp): number {
    let invalidatedCount = 0;

    if (!pattern) {
      // Clear all cache
      invalidatedCount = this.cache.size;
      this.cache.clear();
      this.accessOrder = [];
      return invalidatedCount;
    }

    const regex =
      typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;

    for (const [hash, entry] of this.cache.entries()) {
      if (regex.test(entry.sql)) {
        this.cache.delete(hash);
        this.removeFromAccessOrder(hash);
        invalidatedCount++;
      }
    }

    return invalidatedCount;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Invalidate cache entries related to a specific table
   */
  public invalidateTable(tableName: string): number {
    // Escape special regex characters in table name to prevent regex injection
    const escapedTableName = this.escapeRegex(tableName);

    // Match table name in various SQL patterns
    const patterns = [
      new RegExp(`\\bFROM\\s+[\`"']?${escapedTableName}[\`"']?\\b`, "i"),
      new RegExp(`\\bJOIN\\s+[\`"']?${escapedTableName}[\`"']?\\b`, "i"),
      new RegExp(`\\b${escapedTableName}\\b`, "i"),
    ];

    let invalidatedCount = 0;

    for (const [hash, entry] of this.cache.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(entry.sql)) {
          this.cache.delete(hash);
          this.removeFromAccessOrder(hash);
          invalidatedCount++;
          break;
        }
      }
    }

    return invalidatedCount;
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evictIfNeeded(): void {
    // Check size limit
    while (
      this.cache.size >= this.config.maxSize &&
      this.accessOrder.length > 0
    ) {
      const lruHash = this.accessOrder.shift();
      if (lruHash) {
        this.cache.delete(lruHash);
      }
    }

    // Check memory limit (approximate) - recalculate each iteration
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    while (
      this.estimateMemoryUsage() > maxMemoryBytes &&
      this.accessOrder.length > 0
    ) {
      const lruHash = this.accessOrder.shift();
      if (lruHash) {
        this.cache.delete(lruHash);
      }
    }

    // Also evict expired entries
    const now = Date.now();
    const expiredHashes: string[] = [];
    for (const [hash, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        expiredHashes.push(hash);
      }
    }
    // Delete after iteration to avoid modifying map during iteration
    for (const hash of expiredHashes) {
      this.cache.delete(hash);
      this.removeFromAccessOrder(hash);
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(hash: string): void {
    this.removeFromAccessOrder(hash);
    this.accessOrder.push(hash);
  }

  /**
   * Remove hash from access order
   */
  private removeFromAccessOrder(hash: string): void {
    const index = this.accessOrder.indexOf(hash);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Estimate memory usage of the cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [, entry] of this.cache.entries()) {
      totalSize += JSON.stringify(entry).length * 2; // UTF-16 encoding
    }
    return totalSize;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    return {
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      hitRate: totalRequests > 0 ? this.stats.totalHits / totalRequests : 0,
      currentSize: this.cache.size,
      maxSize: this.config.maxSize,
      ttlMs: this.config.ttlMs,
      enabled: this.config.enabled,
    };
  }

  /**
   * Get current cache configuration
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  public setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // If cache is disabled, clear it
    if (!this.config.enabled) {
      this.clear();
    }
  }

  /**
   * Enable caching
   */
  public enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable caching
   */
  public disable(): void {
    this.config.enabled = false;
    this.clear();
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats.totalHits = 0;
    this.stats.totalMisses = 0;
  }

  /**
   * Get all cached entries (for debugging)
   */
  public getAllEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }
}

export default QueryCache;
