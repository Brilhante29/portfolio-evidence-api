import type {
  BenchmarkComparison,
  BenchmarkResultV2,
  EvidenceStatus,
  OperationReceipt,
  OperationReceiptStatus,
  StoredBenchmarkRun,
} from '../../domain/benchmark-result.js';

export interface OffsetPage<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly offset: number;
  readonly first: number;
  readonly hasNextPage: boolean;
}

export interface RunListRequest {
  readonly first: number;
  readonly offset: number;
  readonly project?: string;
  readonly benchmarkId?: string;
  readonly comparabilityKey?: string;
  readonly status?: EvidenceStatus;
}

export type EvidenceOperationCommand = 'revalidate' | 'quarantine' | 'publication_decision';

export interface OperationTransitionRequest {
  readonly runId: string;
  readonly command: EvidenceOperationCommand;
  readonly idempotencyKey: string;
  readonly requestDigest: string;
  readonly targetStatus: EvidenceStatus;
  readonly receiptStatus: OperationReceiptStatus;
  readonly reason?: string;
}

export type OperationTransitionResult =
  | { readonly kind: 'applied'; readonly receipt: OperationReceipt }
  | { readonly kind: 'replayed'; readonly receipt: OperationReceipt }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'conflict' };

export interface EvidenceWriter {
  insert(evidence: BenchmarkResultV2): Promise<boolean>;
}

export interface EvidenceReader {
  findRun(runId: string): Promise<StoredBenchmarkRun | undefined>;
  findRuns(runIds: readonly string[]): Promise<readonly StoredBenchmarkRun[]>;
  listRuns(request: RunListRequest): Promise<OffsetPage<StoredBenchmarkRun>>;
}

export interface EvidenceOperator {
  transition(request: OperationTransitionRequest): Promise<OperationTransitionResult>;
}

export interface EvidenceStore extends EvidenceWriter, EvidenceReader, EvidenceOperator {}

export interface EvidenceStoreHealth {
  check(): Promise<void>;
}

export type { BenchmarkComparison };
