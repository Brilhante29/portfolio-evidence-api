import { describe, expect, it } from 'vitest';
import {
  InvalidEvidenceError,
  InvalidOperationInputError,
  OperationConflictError,
  RunNotFoundError,
} from '../src/modules/evidence/application/errors.js';
import type {
  EvidenceOperator,
  EvidenceReader,
  OffsetPage,
  OperationTransitionRequest,
  OperationTransitionResult,
  RunListRequest,
} from '../src/modules/evidence/application/ports/evidence-repository.js';
import type {
  EvidenceValidator,
  ValidationResult,
} from '../src/modules/evidence/application/ports/evidence-validator.js';
import { OperateEvidence } from '../src/modules/evidence/application/use-cases/operate-evidence.js';
import type {
  OperationReceipt,
  StoredBenchmarkRun,
} from '../src/modules/evidence/domain/benchmark-result.js';
import { evidenceFixture } from './fixture.js';

const RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e90';

class StubValidator implements EvidenceValidator {
  constructor(private readonly result: ValidationResult) {}

  validate(): ValidationResult {
    return this.result;
  }
}

class StubStore implements EvidenceReader, EvidenceOperator {
  lastTransition?: OperationTransitionRequest;
  transitionResult?: OperationTransitionResult;

  constructor(readonly run?: StoredBenchmarkRun) {}

  findRun(): Promise<StoredBenchmarkRun | undefined> {
    return Promise.resolve(this.run);
  }

  findRuns(): Promise<readonly StoredBenchmarkRun[]> {
    return Promise.resolve(this.run ? [this.run] : []);
  }

  listRuns(request: RunListRequest): Promise<OffsetPage<StoredBenchmarkRun>> {
    return Promise.resolve({
      items: this.run ? [this.run] : [],
      totalCount: this.run ? 1 : 0,
      offset: request.offset,
      first: request.first,
      hasNextPage: false,
    });
  }

  transition(request: OperationTransitionRequest): Promise<OperationTransitionResult> {
    this.lastTransition = request;
    return Promise.resolve(
      this.transitionResult ?? {
        kind: 'applied',
        receipt: receipt(request),
      },
    );
  }
}

describe('OperateEvidence', () => {
  it('revalidates without clearing an operational status', async () => {
    const run = stored('QUARANTINED');
    const store = new StubStore(run);
    const operations = new OperateEvidence(
      store,
      store,
      new StubValidator({ valid: true, evidence: run.evidence }),
    );

    await expect(operations.revalidate(RUN_ID, 'revalidate-key-001')).resolves.toMatchObject({
      status: 'validated',
    });
    expect(store.lastTransition).toMatchObject({
      command: 'revalidate',
      targetStatus: 'QUARANTINED',
      receiptStatus: 'validated',
    });
  });

  it('rejects missing runs and evidence that no longer validates', async () => {
    const missingStore = new StubStore();
    const valid = stored('ACCEPTED');
    const invalidStore = new StubStore(valid);

    await expect(
      new OperateEvidence(
        missingStore,
        missingStore,
        new StubValidator({ valid: true, evidence: valid.evidence }),
      ).revalidate(RUN_ID, 'revalidate-key-001'),
    ).rejects.toBeInstanceOf(RunNotFoundError);

    await expect(
      new OperateEvidence(
        invalidStore,
        invalidStore,
        new StubValidator({
          valid: false,
          issues: [{ path: '/metrics', message: 'invalid' }],
        }),
      ).revalidate(RUN_ID, 'revalidate-key-001'),
    ).rejects.toBeInstanceOf(InvalidEvidenceError);
  });

  it('validates identifiers and reasons before persistence', () => {
    const run = stored('ACCEPTED');
    const store = new StubStore(run);
    const operations = validOperations(store, run);

    expect(() => operations.quarantine('not-a-uuid', 'valid-key-001', 'manual review')).toThrow(
      InvalidOperationInputError,
    );
    expect(() => operations.quarantine(RUN_ID, 'short', 'manual review')).toThrow(
      InvalidOperationInputError,
    );
    expect(() => operations.quarantine(RUN_ID, 'valid-key-001', 'x')).toThrow(
      InvalidOperationInputError,
    );
  });

  it('maps idempotency conflicts from the operator boundary', async () => {
    const run = stored('ACCEPTED');
    const store = new StubStore(run);
    store.transitionResult = { kind: 'conflict' };

    await expect(
      validOperations(store, run).quarantine(RUN_ID, 'quarantine-key-001', 'manual review'),
    ).rejects.toBeInstanceOf(OperationConflictError);
  });

  it('blocks approval when failures or quarantine are present', async () => {
    const run = stored('QUARANTINED', 2);
    const store = new StubStore(run);

    await expect(
      validOperations(store, run).decidePublication(
        RUN_ID,
        'publication-key-001',
        'approve',
        'ready for release',
      ),
    ).rejects.toMatchObject({
      blockers: ['run contains 2 measured failures', 'run is quarantined'],
    });
  });

  it('records approval and rejection as explicit transitions', async () => {
    const run = stored('ACCEPTED');
    const store = new StubStore(run);
    const operations = validOperations(store, run);

    await operations.decidePublication(
      RUN_ID,
      'publication-key-001',
      'approve',
      'evidence reviewed',
    );
    expect(store.lastTransition).toMatchObject({
      targetStatus: 'PUBLICATION_APPROVED',
      receiptStatus: 'publication_approved',
    });

    await operations.decidePublication(
      RUN_ID,
      'publication-key-002',
      'reject',
      'baseline invalidated',
    );
    expect(store.lastTransition).toMatchObject({
      targetStatus: 'PUBLICATION_REJECTED',
      receiptStatus: 'publication_rejected',
    });
  });
});

function stored(status: StoredBenchmarkRun['status'], failures = 0): StoredBenchmarkRun {
  return {
    evidence: evidenceFixture(RUN_ID, 'portfolio-evidence-api', { failures }),
    ingestedAt: '2026-07-21T12:00:00Z',
    status,
  };
}

function validOperations(store: StubStore, run: StoredBenchmarkRun): OperateEvidence {
  return new OperateEvidence(
    store,
    store,
    new StubValidator({ valid: true, evidence: run.evidence }),
  );
}

function receipt(request: OperationTransitionRequest): OperationReceipt {
  return {
    operationId: '018f13c2-2042-7b8e-a824-14dd14269e99',
    runId: request.runId,
    status: request.receiptStatus,
    recordedAt: '2026-07-21T12:00:00Z',
  };
}
