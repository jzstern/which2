import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00Z"));
    limiter = new RateLimiter(2);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    // #given
    const ip = "192.168.1.1";
    // #when
    const result = limiter.check(ip);
    // #then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("allows exactly the limit number of requests", () => {
    // #given
    const ip = "192.168.1.1";
    // #when
    limiter.check(ip);
    const result = limiter.check(ip);
    // #then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    // #given
    const ip = "192.168.1.1";
    // #when
    limiter.check(ip);
    limiter.check(ip);
    const result = limiter.check(ip);
    // #then
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks IPs independently", () => {
    // #given
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";
    // #when
    limiter.check(ip1);
    limiter.check(ip1);
    const result1 = limiter.check(ip1);
    const result2 = limiter.check(ip2);
    // #then
    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  it("resets at UTC midnight", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);
    limiter.check(ip);
    // #when
    vi.setSystemTime(new Date("2026-04-07T00:00:01Z"));
    const result = limiter.check(ip);
    // #then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("returns remaining count without consuming via peek", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);
    // #when
    const remaining = limiter.remaining(ip);
    // #then
    expect(remaining).toBe(1);
  });

  it("refunds a consumed request", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);
    limiter.check(ip);
    expect(limiter.remaining(ip)).toBe(0);

    // #when
    limiter.refund(ip);

    // #then
    expect(limiter.remaining(ip)).toBe(1);
  });

  it("cleans up stale entries", () => {
    // #given
    const ip = "192.168.1.1";
    limiter.check(ip);
    // #when
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
    limiter.cleanup();
    // #then
    expect(limiter.remaining(ip)).toBe(2);
  });
});
