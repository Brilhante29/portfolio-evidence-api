import { Module } from '@nestjs/common';
import { join, resolve } from 'node:path';
import type { EvidenceValidator } from '../../application/ports/evidence-validator.js';
import { IngestBenchmarkRun } from '../../application/use-cases/ingest-benchmark-run.js';
import { OperateEvidence } from '../../application/use-cases/operate-evidence.js';
import { QueryEvidence } from '../../application/use-cases/query-evidence.js';
import { EvidenceResolver } from '../graphql/evidence.resolver.js';
import { JsonScalar } from '../graphql/json.scalar.js';
import { EvidenceController } from '../http/evidence.controller.js';
import { HealthController } from '../http/health.controller.js';
import { OperationsController } from '../http/operations.controller.js';
import { MetricsService } from '../observability/metrics.service.js';
import { SqliteEvidenceRepository } from '../persistence/sqlite-evidence-repository.js';
import { JsonSchemaEvidenceValidator } from '../validation/json-schema-evidence-validator.js';
import { DatabaseLifecycle } from './database-lifecycle.js';
import { EVIDENCE_STORE, EVIDENCE_VALIDATOR } from './evidence.tokens.js';

@Module({
  controllers: [EvidenceController, OperationsController, HealthController],
  providers: [
    MetricsService,
    {
      provide: EVIDENCE_STORE,
      useFactory: async (): Promise<SqliteEvidenceRepository> => {
        const databasePath =
          process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'evidence.db');
        const repository = new SqliteEvidenceRepository(databasePath);
        await repository.initialize();
        return repository;
      },
    },
    {
      provide: EVIDENCE_VALIDATOR,
      useFactory: (): EvidenceValidator =>
        new JsonSchemaEvidenceValidator(
          resolve(
            process.env['BENCHMARK_SCHEMA_PATH'] ??
              join(process.cwd(), 'contracts', 'benchmark-result-v2.schema.json'),
          ),
        ),
    },
    {
      provide: IngestBenchmarkRun,
      useFactory: (validator: EvidenceValidator, repository: SqliteEvidenceRepository) =>
        new IngestBenchmarkRun(validator, repository),
      inject: [EVIDENCE_VALIDATOR, EVIDENCE_STORE],
    },
    {
      provide: QueryEvidence,
      useFactory: (repository: SqliteEvidenceRepository) => new QueryEvidence(repository),
      inject: [EVIDENCE_STORE],
    },
    {
      provide: OperateEvidence,
      useFactory: (repository: SqliteEvidenceRepository, validator: EvidenceValidator) =>
        new OperateEvidence(repository, repository, validator),
      inject: [EVIDENCE_STORE, EVIDENCE_VALIDATOR],
    },
    DatabaseLifecycle,
    EvidenceResolver,
    JsonScalar,
  ],
})
export class EvidenceModule {}
