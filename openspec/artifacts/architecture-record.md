# Architecture Record

Decision: hexagonal modular monolith.

REST owns commands with HTTP and idempotency semantics. GraphQL owns read-only discovery and comparison. Application policy depends on narrow ports. Ajv, Nest, Fastify, Mercurius, Kysely, and SQLite remain adapters. SQLite is accepted for the local single-writer baseline; PostgreSQL is conditional on measured concurrency pressure.
