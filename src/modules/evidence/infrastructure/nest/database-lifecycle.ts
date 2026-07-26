import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { SqliteEvidenceRepository } from '../persistence/sqlite-evidence-repository.js';
import { EVIDENCE_STORE } from './evidence.tokens.js';

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(EVIDENCE_STORE) private readonly repository: SqliteEvidenceRepository) {}

  onApplicationShutdown(): Promise<void> {
    return this.repository.close();
  }
}
