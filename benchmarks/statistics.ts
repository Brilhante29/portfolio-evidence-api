export interface DistributionSummary {
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
}

export function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) {
    throw new Error('percentile requires at least one sample');
  }
  if (quantile < 0 || quantile > 1) {
    throw new Error('quantile must be between zero and one');
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  const value = sorted[index];
  if (value === undefined) {
    throw new Error('percentile index is outside the sample set');
  }
  return value;
}

export function summarize(samples: readonly number[]): DistributionSummary {
  return {
    min: percentile(samples, 0),
    max: percentile(samples, 1),
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
  };
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
