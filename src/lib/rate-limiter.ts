interface RateLimitEntry {
  count: number;
  dateKey: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  check(ip: string): RateLimitResult {
    const today = todayKey();
    const entry = this.store.get(ip);

    if (!entry || entry.dateKey !== today) {
      this.store.set(ip, { count: 1, dateKey: today });
      return { allowed: true, remaining: this.limit - 1 };
    }

    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.limit - entry.count };
  }

  remaining(ip: string): number {
    const today = todayKey();
    const entry = this.store.get(ip);
    if (!entry || entry.dateKey !== today) return this.limit;
    return Math.max(0, this.limit - entry.count);
  }

  refund(ip: string): void {
    const today = todayKey();
    const entry = this.store.get(ip);
    if (entry && entry.dateKey === today && entry.count > 0) {
      entry.count--;
    }
  }

  cleanup(): void {
    const today = todayKey();
    for (const [ip, entry] of this.store) {
      if (entry.dateKey !== today) {
        this.store.delete(ip);
      }
    }
  }
}
