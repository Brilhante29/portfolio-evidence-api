export type MetricDirection = 'higher_is_better' | 'lower_is_better' | 'target';

export type EvidenceStatus =
  'ACCEPTED' | 'QUARANTINED' | 'PUBLICATION_APPROVED' | 'PUBLICATION_REJECTED';

export type OperationReceiptStatus =
  'validated' | 'quarantined' | 'publication_approved' | 'publication_rejected';

export interface BenchmarkMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly direction: MetricDirection;
  readonly samples: readonly number[];
  readonly failures: number;
  readonly summary: Readonly<Record<string, unknown>>;
}

export interface BenchmarkResultV2 {
  readonly schema_version: 2;
  readonly run_id: string;
  readonly project: string;
  readonly benchmark_id: string;
  readonly workload: {
    readonly version: string;
    readonly fixture_digest: string;
    readonly config_digest: string;
    readonly warmup_iterations: number;
    readonly measured_iterations: number;
    readonly concurrency: number;
  };
  readonly metrics: readonly BenchmarkMetric[];
  readonly execution: {
    readonly command: string;
    readonly started_at: string;
    readonly duration_seconds: number;
    readonly exit_code: 0;
    readonly repeat: number;
  };
  readonly environment: Readonly<Record<string, unknown>> & {
    readonly runtime: string;
    readonly architecture: string;
    readonly hardware_class: string;
  };
  readonly provenance: {
    readonly source_commit: string;
    readonly clean_tree: true;
    readonly image_ref: string;
    readonly image_digest: string;
    readonly dependency_lock_digest: string;
    readonly producer: 'local' | 'github-actions' | 'other-ci';
    readonly ci_run_url?: string;
    readonly artifact_digest: string;
  };
  readonly comparability_key: string;
}

export interface StoredBenchmarkRun {
  readonly evidence: BenchmarkResultV2;
  readonly ingestedAt: string;
  readonly status: EvidenceStatus;
}

export interface OperationReceipt {
  readonly operationId: string;
  readonly runId: string;
  readonly status: OperationReceiptStatus;
  readonly recordedAt: string;
}

export interface MetricDelta {
  readonly metricName: string;
  readonly unit: string;
  readonly baselineRunId: string;
  readonly candidateRunId: string;
  readonly absoluteDelta: number;
  readonly percentDelta?: number;
}

export interface BenchmarkComparison {
  readonly comparable: boolean;
  readonly reason?: string;
  readonly comparabilityKey?: string;
  readonly runs: readonly StoredBenchmarkRun[];
  readonly metricDeltas: readonly MetricDelta[];
}
