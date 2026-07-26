import { createHash, randomUUID } from 'node:crypto';
import { cpus, freemem, platform, totalmem } from 'node:os';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import type {
  BenchmarkMetric,
  BenchmarkResultV2,
} from '../src/modules/evidence/domain/benchmark-result.js';
import { percentile, round, summarize } from './statistics.js';

interface BenchmarkMode {
  readonly warmupIterations: number;
  readonly measuredIterations: number;
  readonly repeat: number;
  readonly concurrency: number;
}

interface BenchmarkConfig {
  readonly version: string;
  readonly calibration: BenchmarkMode;
  readonly full: BenchmarkMode;
}

interface LoadResult {
  readonly latenciesMs: readonly number[];
  readonly failures: number;
  readonly durationSeconds: number;
}

interface RepeatResult {
  readonly ingestionP95Ms: number;
  readonly ingestionThroughputRps: number;
  readonly graphqlP95Ms: number;
  readonly failures: number;
}

interface GraphqlResponse {
  readonly data?: {
    readonly benchmarkRun?: { readonly runId: string } | null;
  };
  readonly errors?: readonly unknown[];
}

const root = process.cwd();
const args = process.argv.slice(2);
const calibration = args.includes('--calibrate');
const config = JSON.parse(
  readFileSync(join(root, 'benchmarks', 'config.json'), 'utf8'),
) as BenchmarkConfig;
const mode = calibration ? config.calibration : config.full;
const fixturePath = join(root, 'contracts', 'fixtures', 'benchmark-result-v2.valid.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as BenchmarkResultV2;
const startedAt = new Date();
const startedClock = performance.now();
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'portfolio-evidence-benchmark-'));

process.env['DATABASE_PATH'] = join(temporaryDirectory, 'evidence.db');
process.env['LOG_LEVEL'] = 'silent';

if (!calibration) {
  assertPublishableEnvironment();
}

const { createApplication } = await import('../src/bootstrap.js');
const application = await createApplication();

try {
  await application.listen(0, '127.0.0.1');
  const baseUrl = await application.getUrl();
  const repeats: RepeatResult[] = [];

  for (let repeat = 0; repeat < mode.repeat; repeat += 1) {
    const result = await executeRepeat(baseUrl, fixture, mode);
    repeats.push(result);
  }

  const failures = repeats.reduce((sum, repeat) => sum + repeat.failures, 0);
  if (failures > 0) {
    throw new Error(`benchmark failed closed with ${String(failures)} request failures`);
  }

  const elapsedSeconds = (performance.now() - startedClock) / 1000;
  const report = {
    mode: calibration ? 'calibration' : 'full',
    workload: mode,
    repeats,
    metrics: {
      ingestionP95Ms: round(
        percentile(
          repeats.map((repeat) => repeat.ingestionP95Ms),
          0.95,
        ),
      ),
      ingestionThroughputRps: round(
        percentile(
          repeats.map((repeat) => repeat.ingestionThroughputRps),
          0.5,
        ),
      ),
      graphqlP95Ms: round(
        percentile(
          repeats.map((repeat) => repeat.graphqlP95Ms),
          0.95,
        ),
      ),
    },
  };

  if (calibration) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const result = createEvidenceResult(
      report,
      repeats,
      fixturePath,
      config,
      startedAt,
      elapsedSeconds,
    );
    const outputPath = resolveOutputPath(args);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ outputPath, ...report.metrics }, null, 2));
  }
} finally {
  await application.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

async function executeRepeat(
  baseUrl: string,
  baseFixture: BenchmarkResultV2,
  mode: BenchmarkMode,
): Promise<RepeatResult> {
  const ingestionWarmup = await runLoad(mode.warmupIterations, mode.concurrency, async () => {
    await ingest(baseUrl, withRunId(baseFixture, randomUUID()), 201);
  });
  assertWarmupSucceeded('ingestion', ingestionWarmup);

  const runIds = Array.from({ length: mode.measuredIterations }, () => randomUUID());
  let nextRun = 0;
  const ingestion = await runLoad(mode.measuredIterations, mode.concurrency, async () => {
    const runId = runIds[nextRun];
    nextRun += 1;
    if (!runId) {
      throw new Error('ingestion workload exhausted its run IDs');
    }
    await ingest(baseUrl, withRunId(baseFixture, runId), 201);
  });

  const targetRunId = runIds[0];
  if (!targetRunId) {
    throw new Error('benchmark requires at least one measured iteration');
  }

  const graphqlWarmup = await runLoad(mode.warmupIterations, mode.concurrency, async () => {
    await queryRun(baseUrl, targetRunId);
  });
  assertWarmupSucceeded('GraphQL', graphqlWarmup);
  const graphql = await runLoad(mode.measuredIterations, mode.concurrency, async () =>
    queryRun(baseUrl, targetRunId),
  );

  await assertFailureSemantics(baseUrl, baseFixture, targetRunId);

  return {
    ingestionP95Ms: round(percentile(ingestion.latenciesMs, 0.95)),
    ingestionThroughputRps: round(mode.measuredIterations / ingestion.durationSeconds),
    graphqlP95Ms: round(percentile(graphql.latenciesMs, 0.95)),
    failures: ingestion.failures + graphql.failures,
  };
}

function assertWarmupSucceeded(name: string, result: LoadResult): void {
  if (result.failures > 0) {
    throw new Error(`${name} warmup failed with ${String(result.failures)} request failures`);
  }
}

async function runLoad(
  total: number,
  concurrency: number,
  operation: () => Promise<void>,
): Promise<LoadResult> {
  let cursor = 0;
  let failures = 0;
  const latenciesMs: number[] = [];
  const started = performance.now();

  const workers = Array.from({ length: Math.min(total, concurrency) }, async () => {
    while (cursor < total) {
      cursor += 1;

      const requestStarted = performance.now();
      try {
        await operation();
      } catch {
        failures += 1;
      } finally {
        latenciesMs.push(performance.now() - requestStarted);
      }
    }
  });

  await Promise.all(workers);
  return {
    latenciesMs,
    failures,
    durationSeconds: (performance.now() - started) / 1000,
  };
}

async function ingest(
  baseUrl: string,
  evidence: BenchmarkResultV2,
  expectedStatus: number,
): Promise<void> {
  const response = await fetch(`${baseUrl}/v1/evidence/benchmark-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(evidence),
  });
  await response.arrayBuffer();
  if (response.status !== expectedStatus) {
    throw new Error(
      `ingestion returned ${String(response.status)} instead of ${String(expectedStatus)}`,
    );
  }
}

async function queryRun(baseUrl: string, runId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query:
        'query Benchmark($runId: ID!) { benchmarkRun(runId: $runId) { runId status metrics { name value } } }',
      variables: { runId },
    }),
  });
  const body = (await response.json()) as GraphqlResponse;
  if (
    response.status !== 200 ||
    body.errors !== undefined ||
    body.data?.benchmarkRun?.runId !== runId
  ) {
    throw new Error('GraphQL benchmark query did not return the requested run');
  }
}

async function assertFailureSemantics(
  baseUrl: string,
  baseFixture: BenchmarkResultV2,
  duplicateRunId: string,
): Promise<void> {
  const invalid = await fetch(`${baseUrl}/v1/evidence/benchmark-runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ schema_version: 2, run_id: 'invalid' }),
  });
  await invalid.arrayBuffer();
  if (invalid.status !== 400) {
    throw new Error('invalid evidence probe must return HTTP 400');
  }

  await ingest(baseUrl, withRunId(baseFixture, duplicateRunId), 409);
}

function createEvidenceResult(
  report: {
    readonly metrics: {
      readonly ingestionP95Ms: number;
      readonly ingestionThroughputRps: number;
      readonly graphqlP95Ms: number;
    };
  },
  repeats: readonly RepeatResult[],
  inputFixturePath: string,
  benchmarkConfig: BenchmarkConfig,
  benchmarkStartedAt: Date,
  durationSeconds: number,
): BenchmarkResultV2 {
  const sourceCommit = requiredEnvironment('SOURCE_COMMIT');
  const cleanTree = requiredEnvironment('CLEAN_TREE');
  const imageRef = requiredEnvironment('IMAGE_REF');
  const imageDigest = requiredEnvironment('IMAGE_DIGEST');
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error('SOURCE_COMMIT must be a lowercase 40-character Git SHA');
  }
  if (cleanTree !== 'true') {
    throw new Error('CLEAN_TREE must be exactly true for a publishable result');
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(imageDigest)) {
    throw new Error('IMAGE_DIGEST must use the sha256:<64 lowercase hex> format');
  }

  const metrics: BenchmarkMetric[] = [
    metric(
      'ingestion_p95_ms',
      report.metrics.ingestionP95Ms,
      'ms',
      'lower_is_better',
      repeats.map((repeat) => repeat.ingestionP95Ms),
    ),
    metric(
      'ingestion_throughput_rps',
      report.metrics.ingestionThroughputRps,
      'requests/second',
      'higher_is_better',
      repeats.map((repeat) => repeat.ingestionThroughputRps),
    ),
    metric(
      'graphql_query_p95_ms',
      report.metrics.graphqlP95Ms,
      'ms',
      'lower_is_better',
      repeats.map((repeat) => repeat.graphqlP95Ms),
    ),
  ];
  const rawMeasurement = {
    benchmark: 'evidence-ingestion-http',
    config: benchmarkConfig.full,
    repeats,
    metrics,
  };
  const cpu = cpus()[0];

  return {
    schema_version: 2,
    run_id: randomUUID(),
    project: 'portfolio-evidence-api',
    benchmark_id: 'evidence-ingestion-http',
    workload: {
      version: benchmarkConfig.version,
      fixture_digest: digestFile(inputFixturePath),
      config_digest: digestText(stableStringify(benchmarkConfig.full)),
      warmup_iterations: benchmarkConfig.full.warmupIterations,
      measured_iterations: benchmarkConfig.full.measuredIterations,
      concurrency: benchmarkConfig.full.concurrency,
    },
    metrics,
    execution: {
      command: 'docker run --rm portfolio-evidence-api benchmark',
      started_at: benchmarkStartedAt.toISOString(),
      duration_seconds: round(durationSeconds),
      exit_code: 0,
      repeat: benchmarkConfig.full.repeat,
    },
    environment: {
      runtime: process.version,
      architecture: process.arch,
      hardware_class:
        process.env['HARDWARE_CLASS'] ??
        `${platform()}-${process.arch}-${String(cpus().length)}cpu`,
      platform: platform(),
      cpu_model: cpu?.model ?? 'unknown',
      cpu_count: cpus().length,
      total_memory_bytes: totalmem(),
      free_memory_bytes_after_run: freemem(),
    },
    provenance: {
      source_commit: sourceCommit,
      clean_tree: true,
      image_ref: imageRef,
      image_digest: imageDigest,
      dependency_lock_digest: digestFile(join(root, 'package-lock.json')),
      producer: producer(),
      ...(process.env['CI_RUN_URL'] ? { ci_run_url: process.env['CI_RUN_URL'] } : {}),
      artifact_digest: digestText(stableStringify(rawMeasurement)),
    },
    comparability_key: `evidence-ingestion-http:${benchmarkConfig.version}:sqlite:node${process.versions.node.split('.')[0] ?? 'unknown'}:${process.arch}`,
  };
}

function metric(
  name: string,
  value: number,
  unit: string,
  direction: BenchmarkMetric['direction'],
  samples: readonly number[],
): BenchmarkMetric {
  return {
    name,
    value,
    unit,
    direction,
    samples,
    failures: 0,
    summary: { ...summarize(samples) },
  };
}

function withRunId(fixtureValue: BenchmarkResultV2, runId: string): BenchmarkResultV2 {
  return { ...fixtureValue, run_id: runId };
}

function resolveOutputPath(cliArgs: readonly string[]): string {
  const index = cliArgs.indexOf('--output');
  const supplied = index >= 0 ? cliArgs[index + 1] : undefined;
  return supplied ? resolve(root, supplied) : join(root, 'benchmarks', 'results', 'latest.json');
}

function assertPublishableEnvironment(): void {
  const sourceCommit = requiredEnvironment('SOURCE_COMMIT');
  const cleanTree = requiredEnvironment('CLEAN_TREE');
  requiredEnvironment('IMAGE_REF');
  const imageDigest = requiredEnvironment('IMAGE_DIGEST');
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error('SOURCE_COMMIT must be a lowercase 40-character Git SHA');
  }
  if (cleanTree !== 'true') {
    throw new Error('CLEAN_TREE must be exactly true for a publishable result');
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(imageDigest)) {
    throw new Error('IMAGE_DIGEST must use the sha256:<64 lowercase hex> format');
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for a publishable benchmark result`);
  }
  return value;
}

function producer(): BenchmarkResultV2['provenance']['producer'] {
  const value = process.env['BENCHMARK_PRODUCER'] ?? 'local';
  if (value !== 'local' && value !== 'github-actions' && value !== 'other-ci') {
    throw new Error('BENCHMARK_PRODUCER has an unsupported value');
  }
  return value;
}

function digestFile(path: string): string {
  return digestText(readFileSync(path));
}

function digestText(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
