import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type { OperationReceipt } from '../../domain/benchmark-result.js';
import {
  InvalidEvidenceError,
  InvalidOperationInputError,
  OperationConflictError,
  PublicationBlockedError,
  RunNotFoundError,
} from '../../application/errors.js';
import { OperateEvidence } from '../../application/use-cases/operate-evidence.js';

@Controller('v1/operations/benchmark-runs')
export class OperationsController {
  constructor(private readonly operations: OperateEvidence) {}

  @Post(':runId/revalidate')
  @HttpCode(HttpStatus.OK)
  revalidate(
    @Param('runId') runId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<OperationReceipt> {
    return this.mapErrors(() =>
      this.operations.revalidate(runId, requireIdempotencyKey(idempotencyKey)),
    );
  }

  @Post(':runId/quarantine')
  @HttpCode(HttpStatus.OK)
  quarantine(
    @Param('runId') runId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<OperationReceipt> {
    return this.mapErrors(() =>
      this.operations.quarantine(runId, requireIdempotencyKey(idempotencyKey), readReason(body)),
    );
  }

  @Post(':runId/publication-decision')
  @HttpCode(HttpStatus.OK)
  decidePublication(
    @Param('runId') runId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ): Promise<OperationReceipt> {
    const decision = readDecision(body);
    return this.mapErrors(() =>
      this.operations.decidePublication(
        runId,
        requireIdempotencyKey(idempotencyKey),
        decision,
        readReason(body),
      ),
    );
  }

  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InvalidOperationInputError) {
        throw new BadRequestException({
          error: 'invalid_operation',
          detail: error.message,
        });
      }
      if (error instanceof RunNotFoundError) {
        throw new NotFoundException({
          error: 'run_not_found',
          runId: error.runId,
        });
      }
      if (error instanceof OperationConflictError) {
        throw new ConflictException({
          error: 'idempotency_conflict',
          detail: error.message,
        });
      }
      if (error instanceof PublicationBlockedError) {
        throw new ConflictException({
          error: 'publication_blocked',
          detail: error.message,
          blockers: error.blockers,
        });
      }
      if (error instanceof InvalidEvidenceError) {
        throw new ConflictException({
          error: 'revalidation_failed',
          detail: error.message,
          issues: error.issues,
        });
      }
      throw error;
    }
  }
}

function requireIdempotencyKey(value: string | undefined): string {
  if (!value) {
    throw new InvalidOperationInputError('Idempotency-Key header is required');
  }
  return value;
}

function readReason(body: unknown): string {
  if (!isRecord(body) || typeof body['reason'] !== 'string') {
    throw new InvalidOperationInputError('reason must be a string');
  }
  return body['reason'];
}

function readDecision(body: unknown): 'approve' | 'reject' {
  if (!isRecord(body) || (body['decision'] !== 'approve' && body['decision'] !== 'reject')) {
    throw new InvalidOperationInputError("decision must be either 'approve' or 'reject'");
  }
  return body['decision'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
