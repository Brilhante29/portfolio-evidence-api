import { Controller, Get, Header } from '@nestjs/common';
import type { EvidenceStoreHealth } from '../../application/ports/evidence-repository.js';
import { EVIDENCE_STORE } from '../nest/evidence.tokens.js';
import { Inject } from '@nestjs/common';
import { MetricsService } from '../observability/metrics.service.js';

@Controller()
export class HealthController {
  constructor(
    @Inject(EVIDENCE_STORE) private readonly store: EvidenceStoreHealth,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health')
  async health(): Promise<{ status: 'ok'; database: 'ready' }> {
    await this.store.check();
    return { status: 'ok', database: 'ready' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metricsEndpoint(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
