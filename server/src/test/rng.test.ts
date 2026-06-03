import { describe, expect, it } from 'vitest';

import { logUniformInt, makeZipfSampler, mulberry32 } from '../../prisma/seed/rng.js';

describe('seed rng helpers', () => {
  it('mulberry32 is deterministic for a fixed seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('logUniformInt stays within bounds', () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = logUniformInt(rand, 1, 150);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(150);
    }
  });

  it('zipf sampler favours low ids (celebrity skew)', () => {
    const rand = mulberry32(7);
    const sample = makeZipfSampler(1000, 1.07, rand);
    const counts = new Map<number, number>();
    for (let i = 0; i < 20_000; i++) {
      const id = sample();
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(1000);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // id 1 should be drawn far more often than id 1000.
    expect(counts.get(1) ?? 0).toBeGreaterThan(counts.get(1000) ?? 0);
  });
});
