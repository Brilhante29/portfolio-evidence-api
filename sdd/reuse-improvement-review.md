# Reuse Improvement Review

Project: `31 - portfolio-evidence-api`

## Review Points

- [x] after scaffold
- [x] after architecture decision
- [x] after first working slice
- [x] after benchmark result
- [x] before publication
- [x] after CI or local validation failure

## Findings

| Finding                                                                    | Classification | Kit Area       | Action                                                                                       | Status                    |
| -------------------------------------------------------------------------- | -------------- | -------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| Project validator traversed dependency caches before filtering.            | patch_now      | validation     | Scan Git tracked and non-ignored files only.                                                 | merged in reuse-kit PR #4 |
| Project validator could not read V2 `metrics[]`.                           | patch_now      | contracts      | Resolve the manifest primary metric by name.                                                 | merged in reuse-kit PR #4 |
| Operational OpenAPI omitted real 400 responses.                            | patch_now      | contracts      | Add `InvalidOperation` and bump contract set to 1.1.0.                                       | merged in reuse-kit PR #4 |
| `tsx` did not emit Nest GraphQL decorator metadata.                        | backlog        | skills         | Add compiler-runner guidance to the Node/Nest skill after another repo confirms the pattern. | recorded                  |
| PostgreSQL and Kumo adapters were listed before the problem required them. | reject         | decision-brain | Keep them behind explicit scale or cloud-behavior triggers.                                  | rejected                  |

## Patch Now Decisions

- PR #4: https://github.com/Brilhante29/portfolio-reuse-kit/pull/4
- Kit main: `529caa1666b850f98923160d66a7a60c3ca6e403`.

## Backlog Decisions

- Confirm the Nest decorator-metadata runner rule in the Next/Angular platform work before changing the shared Node skill.

## Rejected Improvements

- Do not move API implementation, SQLite schema, benchmark workload, or repository-specific tests into the kit.
- Do not make Kumo mandatory when no cloud service behavior exists.

## Final Gate

- [x] Reusable improvements were patched or recorded.
- [x] Project-specific implementation was not moved into the kit.
- [x] Validation reflects V2 metrics and bounded file scanning.
