import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BenchmarkResultV2 } from '../src/modules/evidence/domain/benchmark-result.js';

const validFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), 'contracts', 'fixtures', 'benchmark-result-v2.valid.json'),
    'utf8',
  ),
) as BenchmarkResultV2;

export function evidenceFixture(
  runId = validFixture.run_id,
  project = validFixture.project,
  options: { metricValue?: number; comparabilityKey?: string; failures?: number } = {},
): BenchmarkResultV2 {
  return {
    ...structuredClone(validFixture),
    run_id: runId,
    project,
    comparability_key: options.comparabilityKey ?? validFixture.comparability_key,
    metrics: validFixture.metrics.map((metric) => ({
      ...metric,
      value: options.metricValue ?? metric.value,
      failures: options.failures ?? metric.failures,
    })),
  };
}
