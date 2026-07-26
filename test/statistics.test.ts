import { describe, expect, it } from 'vitest';
import { percentile, round, summarize } from '../benchmarks/statistics.js';

describe('benchmark statistics', () => {
  it('uses nearest-rank percentiles over a sorted copy', () => {
    const samples = [4, 1, 3, 2];

    expect(percentile(samples, 0.5)).toBe(2);
    expect(percentile(samples, 0.95)).toBe(4);
    expect(samples).toEqual([4, 1, 3, 2]);
  });

  it('summarizes and rounds deterministic samples', () => {
    expect(summarize([1, 2, 3])).toEqual({
      min: 1,
      max: 3,
      p50: 2,
      p95: 3,
    });
    expect(round(1.23456, 3)).toBe(1.235);
  });

  it('rejects empty or invalid percentile requests', () => {
    expect(() => percentile([], 0.5)).toThrow('percentile requires at least one sample');
    expect(() => percentile([1], 2)).toThrow('quantile must be between zero and one');
  });
});
