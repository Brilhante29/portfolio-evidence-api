# Spec: portfolio-evidence-api

## Claim

The service validates, stores, compares, and governs reproducible benchmark evidence without coupling its domain to transport, persistence, or cloud infrastructure.

## Users

- Portfolio projects publish benchmark-result-v2 evidence.
- The Next.js console reads public benchmark evidence.
- The Angular operations console quarantines, revalidates, and approves or rejects evidence.
- Engineers compare runs only when workload semantics match.

## Scope

In scope:

- V2 JSON Schema validation and semantic metric-name uniqueness.
- Atomic SQLite ingestion with duplicate run rejection.
- Offset-paginated GraphQL reads and run-to-run metric deltas.
- Idempotent operational REST commands with audited receipts.
- Publication blocking for quarantined runs or measured failures.
- Health, Prometheus metrics, structured logs, Docker, CI, and an HTTP benchmark.

Out of scope:

- Authentication and authorization policy.
- Remote artifact blobs.
- Multi-region or multi-writer storage.
- Event brokers, background workflows, and subscriptions.
- A cloud adapter without cloud behavior to emulate.

## Contracts

- Commands: `contracts/portfolio-evidence.openapi.yaml`.
- Reads: `contracts/portfolio-evidence.graphql`.
- Evidence: `contracts/benchmark-result-v2.schema.json`.
- Vendored integrity: `contracts/manifest.json`.

## Acceptance

- Valid evidence returns 201; invalid evidence returns 400; duplicate IDs return 409.
- Operational commands require `Idempotency-Key`; exact replay returns the same receipt; key reuse with a changed payload returns 409.
- A missing run returns 404.
- GraphQL depth above six is rejected.
- Comparisons preserve requested run order and reject missing runs, mismatched keys, metrics, units, or direction.
- The default Docker path requires no secret and runs non-root.
- The benchmark fails closed on request or failure-semantics errors.

## Benchmark

Primary metric: `ingestion_p95_ms`, lower is better.

Secondary metrics:

- `ingestion_throughput_rps`, higher is better.
- `graphql_query_p95_ms`, lower is better.

Publishable command: `docker run --rm portfolio-evidence-api benchmark`.

Result: `benchmarks/results/latest.json`.
