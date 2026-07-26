import { describe, expect, it } from 'vitest';
import { InvalidQueryError } from '../src/modules/evidence/application/errors.js';
import type {
  EvidenceReader,
  OffsetPage,
  RunListRequest,
} from '../src/modules/evidence/application/ports/evidence-repository.js';
import { QueryEvidence } from '../src/modules/evidence/application/use-cases/query-evidence.js';
import type {
  BenchmarkResultV2,
  StoredBenchmarkRun,
} from '../src/modules/evidence/domain/benchmark-result.js';
import { evidenceFixture } from './fixture.js';

const FIRST_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e80';
const SECOND_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e81';

class StubReader implements EvidenceReader {
  lastRequest?: RunListRequest;

  constructor(private readonly runs: readonly StoredBenchmarkRun[]) {}

  findRun(runId: string): Promise<StoredBenchmarkRun | undefined> {
    return Promise.resolve(this.runs.find((run) => run.evidence.run_id === runId));
  }

  findRuns(runIds: readonly string[]): Promise<readonly StoredBenchmarkRun[]> {
    return Promise.resolve(this.runs.filter((run) => runIds.includes(run.evidence.run_id)));
  }

  listRuns(request: RunListRequest): Promise<OffsetPage<StoredBenchmarkRun>> {
    this.lastRequest = request;
    return Promise.resolve({
      items: this.runs,
      totalCount: this.runs.length,
      offset: request.offset,
      first: request.first,
      hasNextPage: false,
    });
  }
}

describe('QueryEvidence', () => {
  it('normalizes list defaults and preserves exact filters', async () => {
    const reader = new StubReader([]);
    const queries = new QueryEvidence(reader);

    await queries.benchmarkRuns({
      project: 'portfolio-evidence-api',
      benchmarkId: 'evidence-ingestion-http',
      comparabilityKey: 'same-key',
      status: 'ACCEPTED',
    });

    expect(reader.lastRequest).toEqual({
      first: 50,
      offset: 0,
      project: 'portfolio-evidence-api',
      benchmarkId: 'evidence-ingestion-http',
      comparabilityKey: 'same-key',
      status: 'ACCEPTED',
    });
  });

  it('rejects invalid pagination and blank identifiers', () => {
    const queries = new QueryEvidence(new StubReader([]));

    expect(() => queries.benchmarkRuns({ first: 0 })).toThrow(InvalidQueryError);
    expect(() => queries.benchmarkRuns({ offset: -1 })).toThrow(InvalidQueryError);
    expect(() => queries.benchmarkRun(' ')).toThrow(InvalidQueryError);
  });

  it('returns ordered metric deltas and omits percent for a zero baseline', async () => {
    const baseline = stored(evidenceFixture(FIRST_RUN_ID, 'baseline', { metricValue: 0 }));
    const candidate = stored(evidenceFixture(SECOND_RUN_ID, 'candidate', { metricValue: 2 }));
    const queries = new QueryEvidence(new StubReader([candidate, baseline]));

    const comparison = await queries.compareBenchmarkRuns([FIRST_RUN_ID, SECOND_RUN_ID]);

    expect(comparison).toMatchObject({
      comparable: true,
      runs: [baseline, candidate],
      metricDeltas: [
        {
          baselineRunId: FIRST_RUN_ID,
          candidateRunId: SECOND_RUN_ID,
          absoluteDelta: 2,
        },
      ],
    });
    expect(comparison.metricDeltas[0]).not.toHaveProperty('percentDelta');
  });

  it('reports missing runs and incompatible comparability keys', async () => {
    const baseline = stored(evidenceFixture(FIRST_RUN_ID));
    const different = stored(
      evidenceFixture(SECOND_RUN_ID, 'candidate', {
        comparabilityKey: 'different-key',
      }),
    );

    const missing = await new QueryEvidence(new StubReader([baseline])).compareBenchmarkRuns([
      FIRST_RUN_ID,
      SECOND_RUN_ID,
    ]);
    const incompatible = await new QueryEvidence(
      new StubReader([baseline, different]),
    ).compareBenchmarkRuns([FIRST_RUN_ID, SECOND_RUN_ID]);

    expect(missing.comparable).toBe(false);
    expect(missing.reason).toContain('missing benchmark runs');
    expect(incompatible).toMatchObject({
      comparable: false,
      reason: 'comparability keys differ between benchmark runs',
    });
  });

  it('rejects missing metrics and incompatible metric semantics', async () => {
    const baseline = stored(evidenceFixture(FIRST_RUN_ID));
    const withoutMetrics = stored({
      ...evidenceFixture(SECOND_RUN_ID),
      metrics: [],
    });
    const changedUnit = stored(
      replaceFirstMetric(evidenceFixture(SECOND_RUN_ID), {
        unit: 'seconds',
      }),
    );

    const missing = await new QueryEvidence(
      new StubReader([baseline, withoutMetrics]),
    ).compareBenchmarkRuns([FIRST_RUN_ID, SECOND_RUN_ID]);
    const incompatible = await new QueryEvidence(
      new StubReader([baseline, changedUnit]),
    ).compareBenchmarkRuns([FIRST_RUN_ID, SECOND_RUN_ID]);

    expect(missing.reason).toContain('is missing');
    expect(incompatible.reason).toContain('incompatible unit or direction');
  });

  it('requires between two and ten distinct run IDs', async () => {
    const queries = new QueryEvidence(new StubReader([]));

    await expect(queries.compareBenchmarkRuns([FIRST_RUN_ID, FIRST_RUN_ID])).rejects.toBeInstanceOf(
      InvalidQueryError,
    );
    await expect(
      queries.compareBenchmarkRuns(
        Array.from(
          { length: 11 },
          (_, index) => `018f13c2-2042-7b8e-a824-${String(index).padStart(12, '0')}`,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidQueryError);
  });
});

function stored(evidence: BenchmarkResultV2): StoredBenchmarkRun {
  return {
    evidence,
    ingestedAt: '2026-07-21T12:00:00Z',
    status: 'ACCEPTED',
  };
}

function replaceFirstMetric(
  evidence: BenchmarkResultV2,
  values: Partial<BenchmarkResultV2['metrics'][number]>,
): BenchmarkResultV2 {
  const firstMetric = evidence.metrics[0];
  if (!firstMetric) {
    throw new Error('fixture must contain one metric');
  }
  return {
    ...evidence,
    metrics: [{ ...firstMetric, ...values }],
  };
}
