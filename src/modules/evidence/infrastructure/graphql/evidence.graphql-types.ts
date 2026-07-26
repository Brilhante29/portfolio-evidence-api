import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import type { OffsetPage } from '../../application/ports/evidence-repository.js';
import { JsonScalar } from './json.scalar.js';
import type {
  BenchmarkComparison,
  MetricDirection,
  StoredBenchmarkRun,
} from '../../domain/benchmark-result.js';

export enum EvidenceStatusType {
  ACCEPTED = 'ACCEPTED',
  QUARANTINED = 'QUARANTINED',
  PUBLICATION_APPROVED = 'PUBLICATION_APPROVED',
  PUBLICATION_REJECTED = 'PUBLICATION_REJECTED',
}

export enum MetricDirectionType {
  HIGHER_IS_BETTER = 'HIGHER_IS_BETTER',
  LOWER_IS_BETTER = 'LOWER_IS_BETTER',
  TARGET = 'TARGET',
}

registerEnumType(EvidenceStatusType, { name: 'EvidenceStatus' });
registerEnumType(MetricDirectionType, { name: 'MetricDirection' });

@ObjectType('OffsetPageInfo')
export class OffsetPageInfoType {
  @Field(() => Int)
  offset!: number;

  @Field(() => Int)
  first!: number;

  @Field(() => Boolean)
  hasNextPage!: boolean;
}

@ObjectType('Workload')
export class WorkloadType {
  @Field()
  version!: string;

  @Field()
  fixtureDigest!: string;

  @Field()
  configDigest!: string;

  @Field(() => Int)
  warmupIterations!: number;

  @Field(() => Int)
  measuredIterations!: number;

  @Field(() => Int)
  concurrency!: number;
}

@ObjectType('BenchmarkMetric')
export class BenchmarkMetricType {
  @Field()
  name!: string;

  @Field(() => Float)
  value!: number;

  @Field()
  unit!: string;

  @Field(() => MetricDirectionType)
  direction!: MetricDirectionType;

  @Field(() => [Float])
  samples!: number[];

  @Field(() => Int)
  failures!: number;

  @Field(() => JsonScalar)
  summary!: Readonly<Record<string, unknown>>;
}

@ObjectType('Execution')
export class ExecutionType {
  @Field()
  command!: string;

  @Field(() => GraphQLISODateTime)
  startedAt!: Date;

  @Field(() => Float)
  durationSeconds!: number;

  @Field(() => Int)
  exitCode!: number;

  @Field(() => Int)
  repeat!: number;
}

@ObjectType('Provenance')
export class ProvenanceType {
  @Field()
  sourceCommit!: string;

  @Field()
  cleanTree!: boolean;

  @Field()
  imageRef!: string;

  @Field()
  imageDigest!: string;

  @Field()
  dependencyLockDigest!: string;

  @Field()
  producer!: string;

  @Field({ nullable: true })
  ciRunUrl?: string;

  @Field()
  artifactDigest!: string;
}

@ObjectType('BenchmarkRun')
export class BenchmarkRunType {
  @Field(() => ID)
  runId!: string;

  @Field(() => Int)
  schemaVersion!: number;

  @Field()
  project!: string;

  @Field()
  benchmarkId!: string;

  @Field()
  comparabilityKey!: string;

  @Field(() => EvidenceStatusType)
  status!: EvidenceStatusType;

  @Field(() => WorkloadType)
  workload!: WorkloadType;

  @Field(() => [BenchmarkMetricType])
  metrics!: BenchmarkMetricType[];

  @Field(() => ExecutionType)
  execution!: ExecutionType;

  @Field(() => JsonScalar)
  environment!: Readonly<Record<string, unknown>>;

  @Field(() => ProvenanceType)
  provenance!: ProvenanceType;
}

@ObjectType('BenchmarkRunConnection')
export class BenchmarkRunConnectionType {
  @Field(() => [BenchmarkRunType])
  items!: BenchmarkRunType[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => OffsetPageInfoType)
  pageInfo!: OffsetPageInfoType;
}

@ObjectType('MetricDelta')
export class MetricDeltaType {
  @Field()
  metricName!: string;

  @Field()
  unit!: string;

  @Field(() => ID)
  baselineRunId!: string;

  @Field(() => ID)
  candidateRunId!: string;

  @Field(() => Float)
  absoluteDelta!: number;

  @Field(() => Float, { nullable: true })
  percentDelta?: number;
}

@ObjectType('BenchmarkComparison')
export class BenchmarkComparisonType {
  @Field()
  comparable!: boolean;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  comparabilityKey?: string;

  @Field(() => [BenchmarkRunType])
  runs!: BenchmarkRunType[];

  @Field(() => [MetricDeltaType])
  metricDeltas!: MetricDeltaType[];
}

export function toRun(run: StoredBenchmarkRun): BenchmarkRunType {
  const evidence = run.evidence;
  return {
    runId: evidence.run_id,
    schemaVersion: evidence.schema_version,
    project: evidence.project,
    benchmarkId: evidence.benchmark_id,
    comparabilityKey: evidence.comparability_key,
    status: run.status as EvidenceStatusType,
    workload: {
      version: evidence.workload.version,
      fixtureDigest: evidence.workload.fixture_digest,
      configDigest: evidence.workload.config_digest,
      warmupIterations: evidence.workload.warmup_iterations,
      measuredIterations: evidence.workload.measured_iterations,
      concurrency: evidence.workload.concurrency,
    },
    metrics: evidence.metrics.map((metric) => ({
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      direction: toMetricDirection(metric.direction),
      samples: [...metric.samples],
      failures: metric.failures,
      summary: metric.summary,
    })),
    execution: {
      command: evidence.execution.command,
      startedAt: new Date(evidence.execution.started_at),
      durationSeconds: evidence.execution.duration_seconds,
      exitCode: evidence.execution.exit_code,
      repeat: evidence.execution.repeat,
    },
    environment: evidence.environment,
    provenance: {
      sourceCommit: evidence.provenance.source_commit,
      cleanTree: evidence.provenance.clean_tree,
      imageRef: evidence.provenance.image_ref,
      imageDigest: evidence.provenance.image_digest,
      dependencyLockDigest: evidence.provenance.dependency_lock_digest,
      producer: evidence.provenance.producer,
      ...(evidence.provenance.ci_run_url ? { ciRunUrl: evidence.provenance.ci_run_url } : {}),
      artifactDigest: evidence.provenance.artifact_digest,
    },
  };
}

export function toRunConnection(page: OffsetPage<StoredBenchmarkRun>): BenchmarkRunConnectionType {
  return {
    items: page.items.map(toRun),
    totalCount: page.totalCount,
    pageInfo: {
      offset: page.offset,
      first: page.first,
      hasNextPage: page.hasNextPage,
    },
  };
}

export function toComparison(comparison: BenchmarkComparison): BenchmarkComparisonType {
  return {
    comparable: comparison.comparable,
    ...(comparison.reason ? { reason: comparison.reason } : {}),
    ...(comparison.comparabilityKey ? { comparabilityKey: comparison.comparabilityKey } : {}),
    runs: comparison.runs.map(toRun),
    metricDeltas: comparison.metricDeltas.map((delta) => ({
      metricName: delta.metricName,
      unit: delta.unit,
      baselineRunId: delta.baselineRunId,
      candidateRunId: delta.candidateRunId,
      absoluteDelta: delta.absoluteDelta,
      ...(delta.percentDelta === undefined ? {} : { percentDelta: delta.percentDelta }),
    })),
  };
}

function toMetricDirection(direction: MetricDirection): MetricDirectionType {
  switch (direction) {
    case 'higher_is_better':
      return MetricDirectionType.HIGHER_IS_BETTER;
    case 'lower_is_better':
      return MetricDirectionType.LOWER_IS_BETTER;
    case 'target':
      return MetricDirectionType.TARGET;
  }
}
