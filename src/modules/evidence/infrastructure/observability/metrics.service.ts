import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export type IngestOutcome = 'accepted' | 'invalid' | 'duplicate' | 'error';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly ingestionDuration: Histogram<'outcome'>;
  private readonly ingestionTotal: Counter<'outcome'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'portfolio_evidence_' });
    this.ingestionDuration = new Histogram({
      name: 'portfolio_evidence_ingestion_duration_seconds',
      help: 'HTTP benchmark evidence ingestion latency.',
      labelNames: ['outcome'],
      registers: [this.registry],
      buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    });
    this.ingestionTotal = new Counter({
      name: 'portfolio_evidence_ingestion_total',
      help: 'Benchmark evidence ingestion attempts by outcome.',
      labelNames: ['outcome'],
      registers: [this.registry],
    });
  }

  observeIngestion(outcome: IngestOutcome, durationSeconds: number): void {
    this.ingestionTotal.inc({ outcome });
    this.ingestionDuration.observe({ outcome }, durationSeconds);
  }
}
