# Agent Handoff

Last updated: 2026-07-26

## Objective

Publish repository #31, `portfolio-evidence-api`, as the evidence producer for the portfolio platform. Do not start repositories #32 or #33 until this repository is on GitHub with green CI.

## Current State

- Branch: `main`; implementation commit `14e43efd63d780d21d71ca2d7ad6b0dde6bcdd0a`.
- Status: benchmarked locally; remote publication and GitHub CI are pending.
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
- GitHub Actions run `30188840609` attempts 1 and 2 passed check, coverage, and calibration, then received raw gzip bytes from the npm audit endpoint; the replacement gate is locally verified and pending CI.

## Decisions

- Hexagonal modular monolith; REST commands and GraphQL reads.
- SQLite now; PostgreSQL only after measured multi-writer pressure.
- No broker or cloud emulator without asynchronous or cloud behavior.
- A future artifact-storage port must prove Kumo locally before AWS.
- Compiled `tsc` output is required for Nest decorator metadata.

## Exact Continuation

1. Run the project and benchmark validators after the dependency-audit gate change.
2. Commit and push the CI transport fix.
3. Wait for the new GitHub Actions run; verify the audit, project validator, Docker smoke, and Docker calibration steps all pass.
4. Promote the generic audit transport to the reuse kit after remote proof.
5. Set `project.yaml` status to `published`, complete GitHub checklist entries, commit, push, and confirm the final check.
6. Start repository #32 only after the API contracts are stable on GitHub.

## Do Not

- Do not alter the measured artifact, provenance, samples, or digest manually.
- Do not claim GitHub CI or publication before verification.
- Do not add PostgreSQL, RabbitMQ, Kafka, Kumo, AWS, authentication, or UI without a problem force.
- Do not move repository-specific code into the reuse kit.

## Efficiency Notes

- `apply_patch` is unavailable in this restricted Windows sandbox; use verified byte writes and reread targets.
- Host Node 22 is outside the declared runtime and crashes the native SQLite worker; authoritative checks run on Node 24 Docker/CI.
- The bounded reuse-kit validator runs in about 3.3 seconds instead of traversing dependency caches.
- Keep heavy write agents limited and leave this handoff current before context limits.
