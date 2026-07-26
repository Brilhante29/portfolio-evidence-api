import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryEvidence } from '../src/modules/evidence/application/use-cases/query-evidence.js';
import { SqliteEvidenceRepository } from '../src/modules/evidence/infrastructure/persistence/sqlite-evidence-repository.js';
import { evidenceFixture } from './fixture.js';

const FIRST_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e60';
const SECOND_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e61';

describe('SqliteEvidenceRepository contract', () => {
  let repository: SqliteEvidenceRepository;

  beforeEach(async () => {
    repository = new SqliteEvidenceRepository(':memory:');
    await repository.initialize();
  });

  afterEach(async () => {
    await repository.close();
  });

  it('atomically rejects duplicate run ids', async () => {
    const evidence = evidenceFixture();
    await expect(repository.insert(evidence)).resolves.toBe(true);
    await expect(repository.insert(evidence)).resolves.toBe(false);

    const page = await repository.listRuns({ first: 10, offset: 0 });
    expect(page.items).toHaveLength(1);
    expect(page.totalCount).toBe(1);
  });

  it('provides offset pagination and exact filters', async () => {
    await repository.insert(evidenceFixture(FIRST_RUN_ID, 'alpha-project'));
    await repository.insert(evidenceFixture(SECOND_RUN_ID, 'beta-project'));

    const page = await repository.listRuns({
      first: 1,
      offset: 0,
      project: 'alpha-project',
      status: 'ACCEPTED',
    });

    expect(page.items.map((run) => run.evidence.project)).toEqual(['alpha-project']);
    expect(page.totalCount).toBe(1);
    expect(page.hasNextPage).toBe(false);
  });

  it('compares runs only when workload semantics match', async () => {
    await repository.insert(evidenceFixture(FIRST_RUN_ID, 'alpha-project', { metricValue: 10 }));
    await repository.insert(evidenceFixture(SECOND_RUN_ID, 'beta-project', { metricValue: 12 }));
    const queries = new QueryEvidence(repository);

    const comparison = await queries.compareBenchmarkRuns([FIRST_RUN_ID, SECOND_RUN_ID]);

    expect(comparison.comparable).toBe(true);
    expect(comparison.metricDeltas[0]?.absoluteDelta).toBe(2);
  });

  it('replays an idempotent transition and rejects key reuse', async () => {
    await repository.insert(evidenceFixture(FIRST_RUN_ID));
    const request = {
      runId: FIRST_RUN_ID,
      command: 'quarantine' as const,
      idempotencyKey: 'quarantine-key-001',
      requestDigest: 'digest-a',
      targetStatus: 'QUARANTINED' as const,
      receiptStatus: 'quarantined' as const,
      reason: 'manual verification',
    };

    const applied = await repository.transition(request);
    const replayed = await repository.transition(request);
    const conflict = await repository.transition({
      ...request,
      requestDigest: 'digest-b',
    });

    expect(applied.kind).toBe('applied');
    expect(replayed).toEqual({
      kind: 'replayed',
      receipt: applied.kind === 'applied' ? applied.receipt : undefined,
    });
    expect(conflict.kind).toBe('conflict');
    await expect(repository.findRun(FIRST_RUN_ID)).resolves.toMatchObject({
      status: 'QUARANTINED',
    });
  });
});
