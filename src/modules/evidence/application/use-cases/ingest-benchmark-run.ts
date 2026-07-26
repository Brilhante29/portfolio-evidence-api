import type { EvidenceWriter } from '../ports/evidence-repository.js';
import type { EvidenceValidator } from '../ports/evidence-validator.js';
import { DuplicateRunError, InvalidEvidenceError } from '../errors.js';

export interface IngestResult {
  readonly runId: string;
  readonly status: 'accepted';
}

export class IngestBenchmarkRun {
  constructor(
    private readonly validator: EvidenceValidator,
    private readonly writer: EvidenceWriter,
  ) {}

  async execute(input: unknown): Promise<IngestResult> {
    const validation = this.validator.validate(input);
    if (!validation.valid) {
      throw new InvalidEvidenceError(validation.issues);
    }

    const metricNames = validation.evidence.metrics.map((metric) => metric.name);
    if (new Set(metricNames).size !== metricNames.length) {
      throw new InvalidEvidenceError([
        { path: '/metrics', message: 'metric names must be unique inside one run' },
      ]);
    }

    const inserted = await this.writer.insert(validation.evidence);
    if (!inserted) {
      throw new DuplicateRunError(validation.evidence.run_id);
    }

    return { runId: validation.evidence.run_id, status: 'accepted' };
  }
}
