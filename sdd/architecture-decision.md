# Architecture Decision

## Status

Accepted on 2026-07-26.

## Context

Evidence arrives from repositories with different stacks but must satisfy one provenance contract. Commands require audit and idempotency; the two planned consoles need a flexible read model. The first deployment is local-first and single-writer, while storage and transport are expected to evolve independently.

Problem forces:

- Domain complexity: medium.
- Integration pressure: high.
- Reproducibility and auditability: high.
- Throughput: medium.
- Independent deployability: medium.
- UI state: none in this repository.

## Decision

Use a hexagonal modular monolith.

Application commands and queries depend on narrow evidence reader, writer, operator, and validator ports. Nest controllers, the Mercurius resolver, Ajv, and Kysely/SQLite are adapters. REST is the command boundary; GraphQL is the read boundary.

```txt
domain <- application ports/use cases <- Nest adapters
                                  <- Ajv validator
                                  <- Kysely/SQLite repository
```

## Principles

- SRP: ingestion, operations, queries, validation, persistence, and observability have separate reasons to change.
- OCP: a PostgreSQL or Kumo-backed adapter can be added without modifying use-case policy.
- LSP: test doubles and SQLite honor the same port semantics, including duplicate rejection, ordering, and idempotent replay.
- ISP: read, write, operation, validation, and health contracts are separate.
- DIP: policy imports interfaces and domain types, not frameworks.
- KISS/YAGNI: one service, one process, one database, no broker, no CQRS framework, and no cloud emulator without cloud behavior.

## Rejected Alternatives

| Alternative       | Reason                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| MVC               | Couples controller concerns too closely to persistence and weakens adapter substitution proof. |
| CQRS framework    | Read/write separation exists in use cases; framework infrastructure adds no current behavior.  |
| Microservices     | No bounded context needs independent ownership, deployment, or asynchronous consistency.       |
| PostgreSQL now    | External operations cost is not justified for a local single-writer registry.                  |
| RabbitMQ or Kafka | There is no asynchronous workload, fan-out, replay stream, or delivery policy to prove.        |

## Consequences

Positive:

- Core policy is executable without Nest or a database.
- REST and GraphQL can evolve without leaking into domain types.
- SQLite keeps the default path credential-free and deterministic.

Tradeoffs:

- SQLite is not a multi-writer scale claim.
- Operations are audited in the same database, not an immutable external event log.
- Authentication remains a later boundary.

Migration trigger:

Move to PostgreSQL only after concurrent writers or remote durability are measured. Add artifact storage only through a port, with Kumo as the first local provider and AWS as an optional adapter.
