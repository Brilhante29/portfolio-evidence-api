import { describe, expect, it } from 'vitest';
import {
  DuplicateRunError,
  InvalidEvidenceError,
} from '../src/modules/evidence/application/errors.js';
import type { EvidenceWriter } from '../src/modules/evidence/application/ports/evidence-repository.js';
import type {
  EvidenceValidator,
  ValidationResult,
} from '../src/modules/evidence/application/ports/evidence-validator.js';
import { IngestBenchmarkRun } from '../src/modules/evidence/application/use-cases/ingest-benchmark-run.js';
import type { BenchmarkResultV2 } from '../src/modules/evidence/domain/benchmark-result.js';
import { evidenceFixture } from './fixture.js';

class StubValidator implements EvidenceValidator {
  constructor(private readonly result: ValidationResult) {}
  validate(): ValidationResult {
    return this.result;
  }
}

class StubWriter implements EvidenceWriter {
  readonly inserted: BenchmarkResultV2[] = [];
  constructor(private readonly accepts = true) {}
  insert(evidence: BenchmarkResultV2): Promise<boolean> {
    this.inserted.push(evidence);
    return Promise.resolve(this.accepts);
  }
}

describe('IngestBenchmarkRun', () => {
  it('accepts validated evidence without a framework or database', async () => {
    const evidence = evidenceFixture();
    const writer = new StubWriter();
    const useCase = new IngestBenchmarkRun(new StubValidator({ valid: true, evidence }), writer);

    await expect(useCase.execute({})).resolves.toEqual({
      runId: evidence.run_id,
      status: 'accepted',
    });
    expect(writer.inserted).toEqual([evidence]);
  });

  it('rejects schema errors before persistence', async () => {
    const writer = new StubWriter();
    const useCase = new IngestBenchmarkRun(
      new StubValidator({ valid: false, issues: [{ path: '/run_id', message: 'invalid' }] }),
      writer,
    );

    await expect(useCase.execute({})).rejects.toBeInstanceOf(InvalidEvidenceError);
    expect(writer.inserted).toHaveLength(0);
  });

  it('rejects duplicate metric names before persistence', async () => {
    const evidence = evidenceFixture();
    const firstMetric = evidence.metrics[0];
    if (!firstMetric) {
      throw new Error('fixture must contain one metric');
    }
    const duplicateMetrics: BenchmarkResultV2 = {
      ...evidence,
      metrics: [firstMetric, firstMetric],
    };
    const writer = new StubWriter();
    const useCase = new IngestBenchmarkRun(
      new StubValidator({ valid: true, evidence: duplicateMetrics }),
      writer,
    );

    await expect(useCase.execute({})).rejects.toBeInstanceOf(InvalidEvidenceError);
    expect(writer.inserted).toHaveLength(0);
  });

  it('maps an atomic repository conflict to a duplicate error', async () => {
    const evidence = evidenceFixture();
    const useCase = new IngestBenchmarkRun(
      new StubValidator({ valid: true, evidence }),
      new StubWriter(false),
    );

    await expect(useCase.execute({})).rejects.toBeInstanceOf(DuplicateRunError);
  });
});
