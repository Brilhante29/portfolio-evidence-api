import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../src/bootstrap.js';
import { evidenceFixture } from './fixture.js';

const FIRST_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e6f';
const SECOND_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e70';
const THIRD_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e71';
const MISSING_RUN_ID = '018f13c2-2042-7b8e-a824-14dd14269e72';

interface IngestReceipt {
  readonly runId: string;
  readonly status: string;
}

interface ProblemResponse {
  readonly error: string;
}

interface OperationReceiptResponse {
  readonly operationId: string;
  readonly runId: string;
  readonly status: string;
  readonly recordedAt: string;
}

interface GraphqlEnvelope<T> {
  readonly data?: T;
  readonly errors?: readonly {
    readonly extensions?: { readonly code?: string };
  }[];
}

interface EvidenceGraphqlData {
  readonly benchmarkRun: {
    readonly runId: string;
    readonly status: string;
    readonly environment: Record<string, unknown>;
  } | null;
  readonly benchmarkRuns: {
    readonly items: readonly {
      readonly runId: string;
      readonly project: string;
      readonly metrics: readonly { readonly name: string; readonly value: number }[];
    }[];
    readonly totalCount: number;
    readonly pageInfo: {
      readonly offset: number;
      readonly first: number;
      readonly hasNextPage: boolean;
    };
  };
  readonly compareBenchmarkRuns: {
    readonly comparable: boolean;
    readonly comparabilityKey: string | null;
    readonly runs: readonly { readonly runId: string }[];
    readonly metricDeltas: readonly {
      readonly metricName: string;
      readonly absoluteDelta: number;
    }[];
  };
}

describe('Portfolio Evidence API e2e', () => {
  let app: NestFastifyApplication | undefined;
  const currentApp = (): NestFastifyApplication => {
    if (!app) {
      throw new Error('application did not initialize');
    }
    return app;
  };
  const first = evidenceFixture(FIRST_RUN_ID);
  const second = evidenceFixture(SECOND_RUN_ID, 'go-rate-limiter', {
    metricValue: 10.2,
  });

  beforeAll(async () => {
    process.env['DATABASE_PATH'] = ':memory:';
    process.env['LOG_LEVEL'] = 'silent';
    app = await createApplication();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env['DATABASE_PATH'];
    delete process.env['LOG_LEVEL'];
  });

  it('reports health before accepting traffic', async () => {
    const response = await currentApp().inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(jsonAs<{ status: string; database: string }>(response)).toEqual({
      status: 'ok',
      database: 'ready',
    });
  });

  it('accepts v2 evidence and rejects invalid and duplicate bodies', async () => {
    const accepted = await currentApp().inject({
      method: 'POST',
      url: '/v1/evidence/benchmark-runs',
      payload: first,
    });
    expect(accepted.statusCode).toBe(201);
    expect(jsonAs<IngestReceipt>(accepted)).toEqual({
      runId: first.run_id,
      status: 'accepted',
    });

    const duplicate = await currentApp().inject({
      method: 'POST',
      url: '/v1/evidence/benchmark-runs',
      payload: first,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(jsonAs<ProblemResponse>(duplicate)).toMatchObject({
      error: 'duplicate_run_id',
    });

    const invalid = await currentApp().inject({
      method: 'POST',
      url: '/v1/evidence/benchmark-runs',
      payload: { schema_version: 2, run_id: 'invalid' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(jsonAs<ProblemResponse>(invalid)).toMatchObject({
      error: 'invalid_evidence',
    });
  });

  it('serves the stable GraphQL read and comparison contract', async () => {
    const inserted = await currentApp().inject({
      method: 'POST',
      url: '/v1/evidence/benchmark-runs',
      payload: second,
    });
    expect(inserted.statusCode).toBe(201);

    const response = await currentApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `
          query Evidence($runId: ID!, $runIds: [ID!]!) {
            benchmarkRun(runId: $runId) {
              runId status environment
            }
            benchmarkRuns(first: 1, offset: 0, status: ACCEPTED) {
              items {
                runId project
                metrics { name value }
              }
              totalCount
              pageInfo { offset first hasNextPage }
            }
            compareBenchmarkRuns(runIds: $runIds) {
              comparable comparabilityKey
              runs { runId }
              metricDeltas { metricName absoluteDelta }
            }
          }
        `,
        variables: {
          runId: FIRST_RUN_ID,
          runIds: [FIRST_RUN_ID, SECOND_RUN_ID],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = jsonAs<GraphqlEnvelope<EvidenceGraphqlData>>(response);
    expect(body.errors).toBeUndefined();
    expect(body.data?.benchmarkRun).toMatchObject({
      runId: FIRST_RUN_ID,
      status: 'ACCEPTED',
    });
    expect(body.data?.benchmarkRuns).toMatchObject({
      totalCount: 2,
      pageInfo: { offset: 0, first: 1, hasNextPage: true },
    });
    expect(body.data?.benchmarkRuns.items).toHaveLength(1);
    expect(body.data?.compareBenchmarkRuns).toMatchObject({
      comparable: true,
      runs: [{ runId: FIRST_RUN_ID }, { runId: SECOND_RUN_ID }],
    });
    expect(body.data?.compareBenchmarkRuns.metricDeltas[0]?.absoluteDelta).toBeCloseTo(-2.2);
  });

  it('applies audited commands idempotently and exposes status through GraphQL', async () => {
    const evidence = evidenceFixture(THIRD_RUN_ID, 'outbox-pattern', {
      failures: 1,
    });
    const inserted = await currentApp().inject({
      method: 'POST',
      url: '/v1/evidence/benchmark-runs',
      payload: evidence,
    });
    expect(inserted.statusCode).toBe(201);

    const missingHeader = await currentApp().inject({
      method: 'POST',
      url: `/v1/operations/benchmark-runs/${THIRD_RUN_ID}/revalidate`,
    });
    expect(missingHeader.statusCode).toBe(400);

    const missingRun = await currentApp().inject({
      method: 'POST',
      url: `/v1/operations/benchmark-runs/${MISSING_RUN_ID}/revalidate`,
      headers: { 'idempotency-key': 'missing-run-key' },
    });
    expect(missingRun.statusCode).toBe(404);

    const quarantineRequest = {
      method: 'POST' as const,
      url: `/v1/operations/benchmark-runs/${THIRD_RUN_ID}/quarantine`,
      headers: { 'idempotency-key': 'quarantine-key-001' },
      payload: { reason: 'manual evidence review' },
    };
    const quarantined = await currentApp().inject(quarantineRequest);
    const replayed = await currentApp().inject(quarantineRequest);
    expect(quarantined.statusCode).toBe(200);
    expect(replayed.statusCode).toBe(200);
    const quarantineReceipt = jsonAs<OperationReceiptResponse>(quarantined);
    expect(jsonAs<OperationReceiptResponse>(replayed)).toEqual(quarantineReceipt);
    expect(quarantineReceipt).toMatchObject({
      runId: THIRD_RUN_ID,
      status: 'quarantined',
    });

    const conflict = await currentApp().inject({
      ...quarantineRequest,
      payload: { reason: 'different reason' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(jsonAs<ProblemResponse>(conflict)).toMatchObject({
      error: 'idempotency_conflict',
    });

    const blocked = await currentApp().inject({
      method: 'POST',
      url: `/v1/operations/benchmark-runs/${THIRD_RUN_ID}/publication-decision`,
      headers: { 'idempotency-key': 'publication-key-001' },
      payload: { decision: 'approve', reason: 'ready for portfolio' },
    });
    expect(blocked.statusCode).toBe(409);
    expect(jsonAs<ProblemResponse>(blocked)).toMatchObject({
      error: 'publication_blocked',
    });

    const rejected = await currentApp().inject({
      method: 'POST',
      url: `/v1/operations/benchmark-runs/${THIRD_RUN_ID}/publication-decision`,
      headers: { 'idempotency-key': 'publication-key-002' },
      payload: { decision: 'reject', reason: 'failed measurement present' },
    });
    expect(rejected.statusCode).toBe(200);
    expect(jsonAs<OperationReceiptResponse>(rejected)).toMatchObject({
      runId: THIRD_RUN_ID,
      status: 'publication_rejected',
    });

    const query = await currentApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `query Status($runId: ID!) {
          benchmarkRun(runId: $runId) { runId status }
        }`,
        variables: { runId: THIRD_RUN_ID },
      },
    });
    const queryBody = jsonAs<
      GraphqlEnvelope<{
        readonly benchmarkRun: {
          readonly runId: string;
          readonly status: string;
        };
      }>
    >(query);
    expect(queryBody.data?.benchmarkRun.status).toBe('PUBLICATION_REJECTED');
  });

  it('blocks operations deeper than the configured GraphQL limit', async () => {
    const response = await currentApp().inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `query TooDeep {
          __schema { types { fields { type { ofType { ofType { ofType { name } } } } } } }
        }`,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = jsonAs<GraphqlEnvelope<unknown>>(response);
    expect(body.errors?.[0]?.extensions?.code).toBe('QUERY_DEPTH_LIMIT');
  });

  it('exports Prometheus metrics for all ingestion outcomes', async () => {
    const response = await currentApp().inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('portfolio_evidence_ingestion_total');
    expect(response.body).toContain('outcome="accepted"');
    expect(response.body).toContain('outcome="invalid"');
    expect(response.body).toContain('outcome="duplicate"');
  });
});

function jsonAs<T>(response: { json(): T }): T {
  return response.json();
}
