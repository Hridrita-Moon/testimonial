/**
 * Per-(ip, spaceId) sliding-window rate limiter for the public
 * submission endpoint.
 *
 * Process-local: a single Map holds one token bucket per key. This
 * is correct for the dev single-instance deployment and acceptable
 * for MVP; when a second instance is added, this should be replaced
 * with an edge-store-backed counter (e.g. Vercel KV or Upstash).
 * The `// TODO: replace with edge KV` marker below is the seam.
 *
 * The bucket is "leaky" in the token-bucket sense: every `RATE_MS`
 * the bucket refills by one token, up to `CAPACITY`. On 0 tokens,
 * the handler returns 429 with `Retry-After` set to the time until
 * the next token.
 *
 * Different `spaceId`s have independent counters, even from the
 * same IP — this satisfies the spec scenario "Different spaces are
 * tracked independently".
 */

const CAPACITY = 5;
const REFILL_INTERVAL_MS = 2_000; // 1 token per 2s -> 5 tokens / 10s

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

// TODO: replace with edge KV when we add a second instance.

/**
 * Try to consume one token from the bucket for `key`. Returns
 *   `{ allowed: true, retryAfterMs: 0 }` when a token was available,
 *   `{ allowed: false, retryAfterMs }` when the bucket was empty.
 * `retryAfterMs` is the time until the next token is available,
 * suitable for a `Retry-After` header (in seconds, rounded up).
 */
export function consume(key: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: CAPACITY, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill: tokens accumulated since lastRefill.
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const refilled = Math.floor(elapsed / REFILL_INTERVAL_MS);
    if (refilled > 0) {
      bucket.tokens = Math.min(CAPACITY, bucket.tokens + refilled);
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  // Time until the next token: the remainder of the current interval.
  const retryAfterMs =
    REFILL_INTERVAL_MS - ((now - bucket.lastRefill) % REFILL_INTERVAL_MS);
  return { allowed: false, retryAfterMs };
}

/**
 * Test-only: reset all buckets. Used by the verification scripts
 * in tasks.md to keep runs deterministic.
 */
export function _resetBucketsForTest(): void {
  buckets.clear();
}