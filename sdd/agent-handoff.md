# Agent Handoff

Last updated: 2026-08-28

## Objective

Keep repository #31, `portfolio-evidence-api`, as the stable evidence producer for the portfolio platform. Repositories #32 and #33 may consume its versioned contracts only after the central publication record is green.

## Current State

- Branch: `main`; published implementation validation commit `bf230a9bac1e5f3dfc3994e1309fdfff36964358`.
- Status: published; GitHub Actions run `33204777497` passed on the implementation validation commit.
- Benchmark source commit: `14e43efd63d780d21d71ca2d7ad6b0dde6bcdd0a`.
- Reuse kit: PR #4 merged at `529caa1666b850f98923160d66a7a60c3ca6e403`.
- Contract set: `portfolio-interoperability 1.1.0`.
- Benchmark artifact: `benchmarks/results/latest.json`.

## Implemented

- NestJS 11, Fastify 5, Mercurius GraphQL, strict TypeScript.
- Ajv V2 validation and semantic metric uniqueness.
- Kysely/SQLite atomic ingestion, WAL, indexes, filters, pagination, and status transitions.
- REST ingestion and idempotent operational commands; GraphQL read-only queries.
- Health, Prometheus, Pino redaction, depth limit, Docker, CI, and real TCP benchmark.
- Complete SDD/OpenSpec, reuse references, and no-secret local-first path.

## Verified

- 35 tests pass in the Node 24 Docker test stage, including dependency-audit transport coverage.
- Coverage: 93.05% statements/lines, 89.4% branches, 100% functions.
- Runtime image, healthcheck, UID 1000, and Node 24 calibration pass.
- Full benchmark: ingestion p95 40.201 ms; throughput 438.148 requests/second; GraphQL p95 24.119 ms; zero failures.
- Provenance: clean commit `14e43efd63d780d21d71ca2d7ad6b0dde6bcdd0a`; image `sha256:09673d4874d540778ea5562d98097802d9636da6eb014dd2bae6df8583ccc6f1`.
- Local benchmark schema/digest validation passes.
- GitHub Actions run `33204777497` passed checks, coverage, calibration, the replacement dependency-advisory gate, the Linux project validator, Docker health, and Docker calibration.
- Full-SHA action pins and literal-path validation were corrected from earlier failed runs; both failure causes are covered by the successful run.

## Decisions

- Hexagonal modular monolith; REST commands and GraphQL reads.
- SQLite now; PostgreSQL only after measured multi-writer pressure.
- No broker or cloud emulator without asynchronous or cloud behavior.
- A future artifact-storage port must prove Kumo locally before AWS.
- Compiled `tsc` output is required for Nest decorator metadata.

## Exact Continuation

1. Require a green exact-head CI run for every future change to `main`.
2. Preserve the V2 benchmark artifact unless a new clean-source full workload intentionally replaces it.
3. Record the final publication SHA and CI URL in `portfolio-reuse-kit`.
4. Promote only the generic dependency-advisory transport and validator lesson; keep service code local.
5. Start repository #32 from the published OpenAPI, GraphQL, and benchmark-result V2 contracts.

## Do Not

- Do not alter the measured artifact, provenance, samples, or digest manually.
- Do not claim GitHub CI or publication before verification.
- Do not add PostgreSQL, RabbitMQ, Kafka, Kumo, AWS, authentication, or UI without a problem force.
- Do not move repository-specific code into the reuse kit.

## Efficiency Notes

- Host Node 22 is outside the declared runtime and crashes the native SQLite worker; authoritative checks run on Node 24 Docker/CI.
- The bounded reuse-kit validator runs in about 3.3 seconds instead of traversing dependency caches.
- Distinguish benchmark provenance, implementation validation, and publication metadata; they legitimately use different SHAs.
