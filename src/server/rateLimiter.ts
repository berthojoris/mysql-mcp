const WINDOW_MS = 60 * 1000;

/**
 * Sliding-window limiter: at most `limit` events per key in any 60 s window.
 * A limit of 0 disables it.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly now: () => number = Date.now,
  ) {}

  get enabled(): boolean {
    return this.limit > 0;
  }

  /** Records a hit; returns 0 when allowed, otherwise the milliseconds until the next slot frees up. */
  consume(key: string): number {
    if (!this.enabled) return 0;
    const now = this.now();
    const recent = (this.hits.get(key) || []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return WINDOW_MS - (now - recent[0]);
    }
    recent.push(now);
    this.hits.set(key, recent);
    return 0;
  }

  /** Drops keys with no hits in the current window. */
  prune(): void {
    const now = this.now();
    for (const [key, times] of this.hits) {
      if (times.every((time) => now - time >= WINDOW_MS)) this.hits.delete(key);
    }
  }
}
