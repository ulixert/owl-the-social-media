// Small, dependency-free randomness helpers for the seed script.
// A fixed seed makes every run reproducible.

/** Deterministic PRNG (mulberry32). Returns a function yielding [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Integer drawn from a log-uniform distribution in [min, max]. Heavy-tailed:
 * most draws are small, a few are large — good for "how many people does this
 * user follow" / "how many posts does this user write".
 */
export function logUniformInt(
  rand: () => number,
  min: number,
  max: number,
): number {
  const lo = Math.log(min);
  const hi = Math.log(max);
  return Math.round(Math.exp(lo + rand() * (hi - lo)));
}

/**
 * Zipf sampler over ids 1..n. Rank 1 (id 1) is the most likely, rank n the
 * least, following a 1/rank^exponent law. Used so that low ids act as
 * "celebrities" that collect most follows, and popular posts collect most
 * likes. Precomputes a cumulative-weight table once; each draw is O(log n).
 */
export function makeZipfSampler(
  n: number,
  exponent: number,
  rand: () => number,
): () => number {
  const cumulative = new Float64Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += 1 / Math.pow(i + 1, exponent);
    cumulative[i] = total;
  }

  return function sample(): number {
    const target = rand() * total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo + 1; // ids are 1-based
  };
}

/** Uniform integer in [min, max]. */
export function uniformInt(
  rand: () => number,
  min: number,
  max: number,
): number {
  return min + Math.floor(rand() * (max - min + 1));
}
