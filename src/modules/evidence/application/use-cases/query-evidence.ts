import { InvalidQueryError } from '../errors.js';
import type { EvidenceReader, OffsetPage, RunListRequest } from '../ports/evidence-repository.js';
import type {
  BenchmarkComparison,
  MetricDelta,
  StoredBenchmarkRun,
} from '../../domain/benchmark-result.js';

const DEFAULT_FIRST = 50;
const MAX_FIRST = 100;
const MAX_COMPARISON_RUNS = 10;

export interface BenchmarkRunQuery {
  readonly first?: number;
  readonly offset?: number;
  readonly project?: string;
  readonly benchmarkId?: string;
  readonly comparabilityKey?: string;
  readonly status?: RunListRequest['status'];
}

export class QueryEvidence {
  constructor(private readonly reader: EvidenceReader) {}

  benchmarkRun(runId: string): Promise<StoredBenchmarkRun | undefined> {
    assertNonBlank(runId, 'runId');
    return this.reader.findRun(runId);
  }

  benchmarkRuns(query: BenchmarkRunQuery): Promise<OffsetPage<StoredBenchmarkRun>> {
    const first = normalizeFirst(query.first ?? DEFAULT_FIRST);
    const offset = normalizeOffset(query.offset ?? 0);
    return this.reader.listRuns({
      first,
      offset,
      ...(query.project ? { project: query.project } : {}),
      ...(query.benchmarkId ? { benchmarkId: query.benchmarkId } : {}),
      ...(query.comparabilityKey ? { comparabilityKey: query.comparabilityKey } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
  }

  async compareBenchmarkRuns(runIds: readonly string[]): Promise<BenchmarkComparison> {
    const normalized = [...new Set(runIds.map((runId) => runId.trim()).filter(Boolean))];
    if (normalized.length < 2) {
      throw new InvalidQueryError('compareBenchmarkRuns requires at least two distinct run IDs');
    }
    if (normalized.length > MAX_COMPARISON_RUNS) {
      throw new InvalidQueryError(
        `compareBenchmarkRuns accepts at most ${String(MAX_COMPARISON_RUNS)} run IDs`,
      );
    }

    const found = await this.reader.findRuns(normalized);
    const byId = new Map(found.map((run) => [run.evidence.run_id, run]));
    const runs = normalized.flatMap((runId) => {
      const run = byId.get(runId);
      return run ? [run] : [];
    });
    const missing = normalized.filter((runId) => !byId.has(runId));
    if (missing.length > 0) {
      return {
        comparable: false,
        reason: `missing benchmark runs: ${missing.join(', ')}`,
        runs,
        metricDeltas: [],
      };
    }

    const keys = new Set(runs.map((run) => run.evidence.comparability_key));
    if (keys.size !== 1) {
      return {
        comparable: false,
        reason: 'comparability keys differ between benchmark runs',
        runs,
        metricDeltas: [],
      };
    }

    const baseline = runs[0];
    if (!baseline) {
      throw new InvalidQueryError('comparison baseline is missing');
    }
    const metricDeltas: MetricDelta[] = [];
    for (const candidate of runs.slice(1)) {
      for (const baselineMetric of baseline.evidence.metrics) {
        const candidateMetric = candidate.evidence.metrics.find(
          (metric) => metric.name === baselineMetric.name,
        );
        if (!candidateMetric) {
          return {
            comparable: false,
            reason: `metric '${baselineMetric.name}' is missing from run ${candidate.evidence.run_id}`,
            runs,
            metricDeltas: [],
          };
        }
        if (
          candidateMetric.unit !== baselineMetric.unit ||
          candidateMetric.direction !== baselineMetric.direction
        ) {
          return {
            comparable: false,
            reason: `metric '${baselineMetric.name}' has incompatible unit or direction`,
            runs,
            metricDeltas: [],
          };
        }
        const absoluteDelta = candidateMetric.value - baselineMetric.value;
        metricDeltas.push({
          metricName: baselineMetric.name,
          unit: baselineMetric.unit,
          baselineRunId: baseline.evidence.run_id,
          candidateRunId: candidate.evidence.run_id,
          absoluteDelta,
          ...(baselineMetric.value === 0
            ? {}
            : { percentDelta: (absoluteDelta / baselineMetric.value) * 100 }),
        });
      }
    }

    return {
      comparable: true,
      comparabilityKey: baseline.evidence.comparability_key,
      runs,
      metricDeltas,
    };
  }
}

function normalizeFirst(first: number): number {
  if (!Number.isInteger(first) || first < 1 || first > MAX_FIRST) {
    throw new InvalidQueryError(`first must be an integer between 1 and ${String(MAX_FIRST)}`);
  }
  return first;
}

function normalizeOffset(offset: number): number {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidQueryError('offset must be a non-negative integer');
  }
  return offset;
}

function assertNonBlank(value: string, name: string): void {
  if (value.trim().length === 0) {
    throw new InvalidQueryError(`${name} must not be blank`);
  }
}
