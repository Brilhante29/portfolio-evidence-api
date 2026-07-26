# Agent Handoff

Last updated: 2026-07-26

## Objective

Finish and publish repository #31, `portfolio-evidence-api`, as the producer for the portfolio evidence platform. Do not start repositories #32 or #33 until the command/read contracts and benchmark result are stable on GitHub.

## Current State

- Branch: `main`; no remote configured and no project commit yet.
- Implementation: complete enough for an implementation commit.
- Publication status: blocked only by clean-source full benchmark, final documentation values, repository creation, and GitHub CI.
- Reuse kit: PR #4 merged at `529caa1666b850f98923160d66a7a60c3ca6e403`.
- Contract set: `portfolio-interoperability 1.1.0`.

## Implemented

- NestJS 11, Fastify 5, Mercurius GraphQL, strict TypeScript.
- Ajv V2 validation and semantic metric uniqueness.
- Kysely/SQLite atomic ingestion, WAL, indexes, filters, offset pagination, and status transitions.
- REST ingestion and idempotent revalidate/quarantine/publication commands.
- GraphQL read-only run, list, and comparison queries.
- Health, Prometheus, Pino redaction, depth limit, Docker, CI, and HTTP benchmark.
- npm lifecycle scripts disabled; better-sqlite3 13.0.1 bundled N-API binary.
- Complete SDD/OpenSpec draft and clean reuse references.

## Verified

- 31 tests pass.
- Coverage: 93.05% statements/lines, 89.4% branches, 100% functions on core/adapters.
- `npm run typecheck`, `npm run lint`, and benchmark calibration pass.
- Node 24 Docker image builds.
- Container calibration: ingestion p95 13.816 ms, throughput 174.479 requests/s, GraphQL p95 18.044 ms, zero failures.
- Container health: `{"status":"ok","database":"ready"}`.
- Runtime UID: 1000.
- Local cached npm audit reported zero advisories but is not authoritative; GitHub CI must run online audit.

## Known Decisions

- Hexagonal modular monolith, not MVC, CQRS framework, or microservices.
- REST commands; GraphQL reads.
- SQLite now; PostgreSQL only after measured multi-writer pressure.
- No broker because there is no async behavior.
- No cloud/Kumo process because there is no cloud behavior. A future artifact-storage port must prove Kumo before AWS.
- Use compiled `tsc` output for Nest runtime. `tsx/esbuild` failed GraphQL decorator metadata.

## Exact Continuation

1. Run formatting, lint, typecheck, tests, coverage, build, calibration, and `git diff --check`.
2. Commit the implementation with README benchmark still pending.
3. Confirm the tree is clean and build `portfolio-evidence-api:benchmark` from that commit.
4. Record its 40-character SHA and Docker image ID.
5. Run the full benchmark in a named container with `SOURCE_COMMIT`, `CLEAN_TREE=true`, `IMAGE_REF`, and `IMAGE_DIGEST`.
6. Copy `/app/benchmarks/results/latest.json` from the stopped container.
7. Run `npm run validate:benchmark -- benchmarks/results/latest.json`.
8. Put the exact primary value in the first eight README lines; set project status to `benchmarked`; finish OpenSpec proof, verification, checklist, and this handoff.
9. Run `tools/validate-project.ps1 -SkipDocker`, full local gates, and one final Docker smoke.
10. Commit evidence, create the GitHub repository, push, wait for green CI, then mark status `published`.

## Do Not

- Do not fake `clean_tree`, image digest, CI URL, throughput, or benchmark samples.
- Do not add PostgreSQL, RabbitMQ, Kafka, Kumo, AWS, authentication, or a UI to make the stack list longer.
- Do not publish an empty GitHub repository.
- Do not reuse an idempotency key with a changed payload.
- Do not move project-specific code into the reuse kit.

## Efficiency Notes

- `apply_patch` is unavailable in this Windows restricted-token sandbox; use verified byte writes and always reread the target.
- Vitest through esbuild needs elevated execution in this environment; `tsc` and compiled benchmark do not.
- The old validator recursively traversed `node_modules` and was terminated after 30 seconds; reuse-kit PR #4 reduced the run to 3.3 seconds.
- Two failed Docker builds identified obsolete better-sqlite3 packaging and npm auto-node-gyp behavior. Do not add compilers; keep 13.0.1 and lifecycle scripts disabled.
- Limit heavy write agents to two and stabilize producer contracts before consumer repositories.
