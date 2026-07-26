# Technical Decision

## Runtime

Node.js 24 LTS with strict TypeScript and `tsc` output. Nest decorator metadata is emitted by `tsc`; executable paths do not rely on `tsx/esbuild`, which failed to provide the metadata required by code-first GraphQL.

## HTTP And GraphQL

- NestJS 11 provides modules, dependency injection, controllers, and resolvers.
- Fastify 5 is the HTTP adapter and the surface measured by the benchmark.
- Mercurius is the GraphQL engine because it is native to Fastify.
- REST handles commands and idempotency; GraphQL handles reads and comparisons.
- GraphQL mutations and subscriptions are excluded.

## Data

- Kysely keeps SQL and transactions visible.
- SQLite provides atomic local persistence, WAL for file databases, and a credential-free demo.
- The run payload remains immutable JSON; status is stored separately.
- An idempotency key is globally unique and bound to a request digest.

## Validation And Operations

- Ajv 2020 validates the vendored V2 JSON Schema.
- Semantic checks reject duplicate metric names.
- Publication approval is blocked by failures or quarantine.
- Revalidation preserves the current operational status and cannot silently clear quarantine.

## Supply Chain

- `package-lock.json` is committed.
- npm lifecycle scripts are disabled by default; `better-sqlite3 13.0.1` ships N-API binaries in the package.
- The Docker image is multi-stage, Node 24, non-root, and contains production dependencies only.
- Online advisory validation runs in GitHub Actions; local offline audit is non-authoritative.

## Deliberate Absences

No Prisma, ORM-generated model, broker, Redis, PostgreSQL, cloud SDK, Kumo process, or OpenTelemetry collector is added. Each would need a concrete behavior and benchmark before entering this repository.
