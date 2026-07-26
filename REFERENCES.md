# References

No third-party source code was copied into this repository. Dependencies are consumed through their published packages.

| Reference                                                                               | License            | Used for                                                  | Copied code?                      |
| --------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------- | --------------------------------- |
| [NestJS](https://github.com/nestjs/nest)                                                | MIT                | modules, dependency injection, HTTP application structure | no                                |
| [NestJS GraphQL](https://github.com/nestjs/graphql)                                     | MIT                | code-first resolver integration                           | no                                |
| [Fastify](https://github.com/fastify/fastify)                                           | MIT                | HTTP adapter and benchmark surface                        | no                                |
| [Mercurius](https://github.com/mercurius-js/mercurius)                                  | MIT                | Fastify-native GraphQL execution                          | no                                |
| [Kysely](https://github.com/kysely-org/kysely)                                          | MIT                | typed SQL and transactions                                | no                                |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)                            | MIT                | synchronous SQLite driver and bundled N-API binary        | no                                |
| [Ajv](https://github.com/ajv-validator/ajv)                                             | MIT                | JSON Schema 2020-12 validation                            | no                                |
| [prom-client](https://github.com/siimon/prom-client)                                    | Apache-2.0         | Prometheus metrics                                        | no                                |
| [OpenAPI 3.1](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md) | Apache-2.0         | REST command contract                                     | no                                |
| [GraphQL specification](https://github.com/graphql/graphql-spec)                        | MIT                | read contract semantics                                   | no                                |
| [OpenSpec](https://openspec.dev/)                                                       | project terms      | spec-driven artifact organization                         | no                                |
| [AI Templates](https://aitmpl.com/)                                                     | project terms      | agent template research                                   | no                                |
| [05-nest-clean](https://github.com/rocketseat-education/05-nest-clean)                  | repository license | architectural organization reference                      | no                                |
| [programadorLhama](https://github.com/programadorLhama)                                 | per repository     | repository organization reference                         | no                                |
| [portfolio-reuse-kit](https://github.com/Brilhante29/portfolio-reuse-kit)               | MIT                | contracts, SDD, skills, validator, design tokens          | vendored contracts/templates only |

## Reuse Boundary

The shared kit contributes schemas, decision rules, templates, skills, and design tokens. Domain policy, SQLite schema, Nest adapters, benchmark implementation, tests, and documentation claims belong to this repository.
