import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { BenchmarkResultV2 } from '../src/modules/evidence/domain/benchmark-result.js';

const root = process.cwd();
const resultPath = process.argv[2] ?? join(root, 'benchmarks', 'results', 'latest.json');
const schema = JSON.parse(
  readFileSync(join(root, 'contracts', 'benchmark-result-v2.schema.json'), 'utf8'),
) as object;
const value = JSON.parse(readFileSync(resultPath, 'utf8')) as unknown;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
const validate = ajv.compile(schema);

if (!validate(value)) {
  console.error(formatErrors(validate.errors));
  process.exitCode = 1;
} else {
  const result = value as BenchmarkResultV2;
  const primary = result.metrics.find((metric) => metric.name === 'ingestion_p95_ms');
  if (!primary) {
    throw new Error('result does not contain primary metric ingestion_p95_ms');
  }
  if (result.metrics.some((metric) => metric.failures > 0)) {
    throw new Error('publishable benchmark result contains measured failures');
  }
  console.log(`valid benchmark: ${primary.name}=${String(primary.value)} ${primary.unit}`);
}

function formatErrors(errors: readonly ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('\n');
}
