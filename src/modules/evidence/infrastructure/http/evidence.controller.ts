import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { DuplicateRunError, InvalidEvidenceError } from '../../application/errors.js';
import { IngestBenchmarkRun } from '../../application/use-cases/ingest-benchmark-run.js';
import { MetricsService, type IngestOutcome } from '../observability/metrics.service.js';

@Controller('v1/evidence/benchmark-runs')
export class EvidenceController {
  constructor(
    private readonly ingest: IngestBenchmarkRun,
    private readonly metrics: MetricsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: unknown): Promise<{ runId: string; status: 'accepted' }> {
    const started = performance.now();
    let outcome: IngestOutcome = 'error';
    try {
      const result = await this.ingest.execute(body);
      outcome = 'accepted';
      return result;
    } catch (error) {
      if (error instanceof InvalidEvidenceError) {
        outcome = 'invalid';
        throw new BadRequestException({ error: 'invalid_evidence', issues: error.issues });
      }
      if (error instanceof DuplicateRunError) {
        outcome = 'duplicate';
        throw new ConflictException({ error: 'duplicate_run_id', runId: error.runId });
      }
      throw error;
    } finally {
      this.metrics.observeIngestion(outcome, (performance.now() - started) / 1000);
    }
  }
}
