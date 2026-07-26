import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type {
  OffsetPage,
  OperationTransitionRequest,
  OperationTransitionResult,
  RunListRequest,
} from '../../application/ports/evidence-repository.js';
import type {
  BenchmarkResultV2,
  EvidenceStatus,
  OperationReceipt,
  OperationReceiptStatus,
  StoredBenchmarkRun,
} from '../../domain/benchmark-result.js';

interface BenchmarkRunsTable {
  run_id: string;
  project: string;
  benchmark_id: string;
  comparability_key: string;
  status: EvidenceStatus;
  started_at: string;
  ingested_at: string;
  payload_json: string;
}

interface BenchmarkMetricsTable {
  run_id: string;
  name: string;
  value: number;
  unit: string;
  direction: string;
  failures: number;
  summary_json: string;
}

interface EvidenceOperationsTable {
  operation_id: string;
  idempotency_key: string;
  run_id: string;
  command: string;
  request_digest: string;
  target_status: EvidenceStatus;
  receipt_status: OperationReceiptStatus;
  recorded_at: string;
  reason: string | null;
}

interface EvidenceDatabase {
  benchmark_runs: BenchmarkRunsTable;
  benchmark_metrics: BenchmarkMetricsTable;
  evidence_operations: EvidenceOperationsTable;
}

interface SqliteColumn {
  readonly name: string;
}

export class SqliteEvidenceRepository {
  private readonly sqlite: Database.Database;
  private readonly db: Kysely<EvidenceDatabase>;

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.sqlite = new Database(databasePath);
    this.sqlite.pragma('foreign_keys = ON');
    if (databasePath !== ':memory:') {
      this.sqlite.pragma('journal_mode = WAL');
    }
    this.db = new Kysely<EvidenceDatabase>({
      dialect: new SqliteDialect({ database: this.sqlite }),
    });
  }

  async initialize(): Promise<void> {
    await this.db.schema
      .createTable('benchmark_runs')
      .ifNotExists()
      .addColumn('run_id', 'text', (column) => column.primaryKey())
      .addColumn('project', 'text', (column) => column.notNull())
      .addColumn('benchmark_id', 'text', (column) => column.notNull())
      .addColumn('comparability_key', 'text', (column) => column.notNull())
      .addColumn('status', 'text', (column) => column.notNull().defaultTo('ACCEPTED'))
      .addColumn('started_at', 'text', (column) => column.notNull())
      .addColumn('ingested_at', 'text', (column) => column.notNull())
      .addColumn('payload_json', 'text', (column) => column.notNull())
      .execute();

    const columns = this.sqlite.pragma('table_info(benchmark_runs)') as SqliteColumn[];
    if (!columns.some((column) => column.name === 'status')) {
      this.sqlite.exec(
        "ALTER TABLE benchmark_runs ADD COLUMN status TEXT NOT NULL DEFAULT 'ACCEPTED'",
      );
    }

    await this.db.schema
      .createTable('benchmark_metrics')
      .ifNotExists()
      .addColumn('run_id', 'text', (column) =>
        column.notNull().references('benchmark_runs.run_id').onDelete('cascade'),
      )
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('value', 'real', (column) => column.notNull())
      .addColumn('unit', 'text', (column) => column.notNull())
      .addColumn('direction', 'text', (column) => column.notNull())
      .addColumn('failures', 'integer', (column) => column.notNull())
      .addColumn('summary_json', 'text', (column) => column.notNull())
      .addPrimaryKeyConstraint('benchmark_metrics_pk', ['run_id', 'name'])
      .execute();

    await this.db.schema
      .createTable('evidence_operations')
      .ifNotExists()
      .addColumn('operation_id', 'text', (column) => column.primaryKey())
      .addColumn('idempotency_key', 'text', (column) => column.notNull().unique())
      .addColumn('run_id', 'text', (column) =>
        column.notNull().references('benchmark_runs.run_id').onDelete('cascade'),
      )
      .addColumn('command', 'text', (column) => column.notNull())
      .addColumn('request_digest', 'text', (column) => column.notNull())
      .addColumn('target_status', 'text', (column) => column.notNull())
      .addColumn('receipt_status', 'text', (column) => column.notNull())
      .addColumn('recorded_at', 'text', (column) => column.notNull())
      .addColumn('reason', 'text')
      .execute();

    await Promise.all([
      this.db.schema
        .createIndex('benchmark_runs_project_started_idx')
        .ifNotExists()
        .on('benchmark_runs')
        .columns(['project', 'started_at'])
        .execute(),
      this.db.schema
        .createIndex('benchmark_runs_query_idx')
        .ifNotExists()
        .on('benchmark_runs')
        .columns(['benchmark_id', 'comparability_key', 'status'])
        .execute(),
      this.db.schema
        .createIndex('benchmark_metrics_name_idx')
        .ifNotExists()
        .on('benchmark_metrics')
        .column('name')
        .execute(),
      this.db.schema
        .createIndex('evidence_operations_run_idx')
        .ifNotExists()
        .on('evidence_operations')
        .columns(['run_id', 'recorded_at'])
        .execute(),
    ]);
  }

  async insert(evidence: BenchmarkResultV2): Promise<boolean> {
    return this.db.transaction().execute(async (transaction) => {
      const result = await transaction
        .insertInto('benchmark_runs')
        .values({
          run_id: evidence.run_id,
          project: evidence.project,
          benchmark_id: evidence.benchmark_id,
          comparability_key: evidence.comparability_key,
          status: 'ACCEPTED',
          started_at: evidence.execution.started_at,
          ingested_at: new Date().toISOString(),
          payload_json: JSON.stringify(evidence),
        })
        .onConflict((conflict) => conflict.column('run_id').doNothing())
        .executeTakeFirst();

      if (result.numInsertedOrUpdatedRows === 0n) {
        return false;
      }

      await transaction
        .insertInto('benchmark_metrics')
        .values(
          evidence.metrics.map((metric) => ({
            run_id: evidence.run_id,
            name: metric.name,
            value: metric.value,
            unit: metric.unit,
            direction: metric.direction,
            failures: metric.failures,
            summary_json: JSON.stringify(metric.summary),
          })),
        )
        .execute();
      return true;
    });
  }

  async findRun(runId: string): Promise<StoredBenchmarkRun | undefined> {
    const row = await this.db
      .selectFrom('benchmark_runs')
      .selectAll()
      .where('run_id', '=', runId)
      .executeTakeFirst();
    return row ? toStoredRun(row) : undefined;
  }

  async findRuns(runIds: readonly string[]): Promise<readonly StoredBenchmarkRun[]> {
    if (runIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom('benchmark_runs')
      .selectAll()
      .where('run_id', 'in', runIds)
      .execute();
    return rows.map(toStoredRun);
  }

  async listRuns(request: RunListRequest): Promise<OffsetPage<StoredBenchmarkRun>> {
    let rowsQuery = this.db.selectFrom('benchmark_runs').selectAll();
    let countQuery = this.db
      .selectFrom('benchmark_runs')
      .select((expression) => expression.fn.countAll<number>().as('total_count'));

    if (request.project) {
      rowsQuery = rowsQuery.where('project', '=', request.project);
      countQuery = countQuery.where('project', '=', request.project);
    }
    if (request.benchmarkId) {
      rowsQuery = rowsQuery.where('benchmark_id', '=', request.benchmarkId);
      countQuery = countQuery.where('benchmark_id', '=', request.benchmarkId);
    }
    if (request.comparabilityKey) {
      rowsQuery = rowsQuery.where('comparability_key', '=', request.comparabilityKey);
      countQuery = countQuery.where('comparability_key', '=', request.comparabilityKey);
    }
    if (request.status) {
      rowsQuery = rowsQuery.where('status', '=', request.status);
      countQuery = countQuery.where('status', '=', request.status);
    }

    const [rows, count] = await Promise.all([
      rowsQuery
        .orderBy('started_at', 'desc')
        .orderBy('run_id', 'desc')
        .limit(request.first)
        .offset(request.offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.map(toStoredRun),
      totalCount: count.total_count,
      offset: request.offset,
      first: request.first,
      hasNextPage: request.offset + rows.length < count.total_count,
    };
  }

  transition(request: OperationTransitionRequest): Promise<OperationTransitionResult> {
    return this.db.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom('evidence_operations')
        .selectAll()
        .where('idempotency_key', '=', request.idempotencyKey)
        .executeTakeFirst();

      if (existing) {
        if (
          existing.run_id !== request.runId ||
          existing.command !== request.command ||
          existing.request_digest !== request.requestDigest
        ) {
          return { kind: 'conflict' };
        }
        return { kind: 'replayed', receipt: toOperationReceipt(existing) };
      }

      const run = await transaction
        .selectFrom('benchmark_runs')
        .select('run_id')
        .where('run_id', '=', request.runId)
        .executeTakeFirst();
      if (!run) {
        return { kind: 'not_found' };
      }

      const operationId = randomUUID();
      const recordedAt = new Date().toISOString();
      await transaction
        .updateTable('benchmark_runs')
        .set({ status: request.targetStatus })
        .where('run_id', '=', request.runId)
        .executeTakeFirstOrThrow();

      await transaction
        .insertInto('evidence_operations')
        .values({
          operation_id: operationId,
          idempotency_key: request.idempotencyKey,
          run_id: request.runId,
          command: request.command,
          request_digest: request.requestDigest,
          target_status: request.targetStatus,
          receipt_status: request.receiptStatus,
          recorded_at: recordedAt,
          reason: request.reason ?? null,
        })
        .executeTakeFirstOrThrow();

      return {
        kind: 'applied',
        receipt: {
          operationId,
          runId: request.runId,
          status: request.receiptStatus,
          recordedAt,
        },
      };
    });
  }

  async check(): Promise<void> {
    await this.db.selectFrom('benchmark_runs').select('run_id').limit(1).execute();
  }

  close(): Promise<void> {
    return this.db.destroy();
  }
}

function toStoredRun(row: BenchmarkRunsTable): StoredBenchmarkRun {
  return {
    evidence: JSON.parse(row.payload_json) as BenchmarkResultV2,
    ingestedAt: row.ingested_at,
    status: row.status,
  };
}

function toOperationReceipt(row: EvidenceOperationsTable): OperationReceipt {
  return {
    operationId: row.operation_id,
    runId: row.run_id,
    status: row.receipt_status,
    recordedAt: row.recorded_at,
  };
}
