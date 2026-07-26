import { createHash } from 'node:crypto';
import type { OperationReceipt } from '../../domain/benchmark-result.js';
import {
  InvalidEvidenceError,
  InvalidOperationInputError,
  OperationConflictError,
  PublicationBlockedError,
  RunNotFoundError,
} from '../errors.js';
import type {
  EvidenceOperator,
  EvidenceReader,
  OperationTransitionRequest,
} from '../ports/evidence-repository.js';
import type { EvidenceValidator } from '../ports/evidence-validator.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OperateEvidence {
  constructor(
    private readonly reader: EvidenceReader,
    private readonly operator: EvidenceOperator,
    private readonly validator: EvidenceValidator,
  ) {}

  async revalidate(runId: string, idempotencyKey: string): Promise<OperationReceipt> {
    validateIdentifiers(runId, idempotencyKey);
    const run = await this.reader.findRun(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    const validation = this.validator.validate(run.evidence);
    if (!validation.valid) {
      throw new InvalidEvidenceError(validation.issues);
    }

    return this.apply({
      runId,
      command: 'revalidate',
      idempotencyKey,
      requestDigest: digest({ command: 'revalidate', runId }),
      targetStatus: run.status,
      receiptStatus: 'validated',
    });
  }

  quarantine(runId: string, idempotencyKey: string, reason: string): Promise<OperationReceipt> {
    validateIdentifiers(runId, idempotencyKey);
    const normalizedReason = validateReason(reason);
    return this.apply({
      runId,
      command: 'quarantine',
      idempotencyKey,
      requestDigest: digest({ command: 'quarantine', runId, reason: normalizedReason }),
      targetStatus: 'QUARANTINED',
      receiptStatus: 'quarantined',
      reason: normalizedReason,
    });
  }

  async decidePublication(
    runId: string,
    idempotencyKey: string,
    decision: 'approve' | 'reject',
    reason: string,
  ): Promise<OperationReceipt> {
    validateIdentifiers(runId, idempotencyKey);
    const normalizedReason = validateReason(reason);
    const run = await this.reader.findRun(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    if (decision === 'approve') {
      const blockers: string[] = [];
      const failures = run.evidence.metrics.reduce((total, metric) => total + metric.failures, 0);
      if (failures > 0) {
        blockers.push(`run contains ${String(failures)} measured failures`);
      }
      if (run.status === 'QUARANTINED') {
        blockers.push('run is quarantined');
      }
      if (blockers.length > 0) {
        throw new PublicationBlockedError(blockers);
      }
    }

    return this.apply({
      runId,
      command: 'publication_decision',
      idempotencyKey,
      requestDigest: digest({
        command: 'publication_decision',
        runId,
        decision,
        reason: normalizedReason,
      }),
      targetStatus: decision === 'approve' ? 'PUBLICATION_APPROVED' : 'PUBLICATION_REJECTED',
      receiptStatus: decision === 'approve' ? 'publication_approved' : 'publication_rejected',
      reason: normalizedReason,
    });
  }

  private async apply(request: OperationTransitionRequest): Promise<OperationReceipt> {
    const result = await this.operator.transition(request);
    switch (result.kind) {
      case 'not_found':
        throw new RunNotFoundError(request.runId);
      case 'conflict':
        throw new OperationConflictError(
          'Idempotency-Key was already used for a different command payload.',
        );
      case 'applied':
      case 'replayed':
        return result.receipt;
    }
  }
}

function validateIdentifiers(runId: string, idempotencyKey: string): void {
  if (!UUID_PATTERN.test(runId)) {
    throw new InvalidOperationInputError('runId must be a UUID');
  }
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw new InvalidOperationInputError(
      'Idempotency-Key must contain between 8 and 128 characters',
    );
  }
}

function validateReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length < 3 || normalized.length > 1000) {
    throw new InvalidOperationInputError('reason must contain between 3 and 1000 characters');
  }
  return normalized;
}

function digest(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
