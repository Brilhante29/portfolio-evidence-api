# Agents

This repository is governed by `portfolio-reuse-kit`.

Agents must use the local `.portfolio/` snapshot as the source of truth when it exists. If `.portfolio/` is not present, consult the upstream kit before making architectural or stack decisions.

## Operating Graph

Read `.portfolio/decision-brain/agent-graph.yaml` first. The principal agent coordinates these roles:

0. `agentic-spec-governance`
0. `component-pack-selector`
1. `program-planner`
2. `architecture-selector`
3. `engineering-principles-reviewer`
4. `stack-decision-agent`
5. `api-style-agent`
6. `cloud-local-first-agent`
7. `messaging-agent`
8. `language-profile-agent`
9. `benchmark-harness-agent`
10. `design-system-agent`
11. `security-reuse-reviewer`
12. `reuse-improvement-reviewer`
13. `release-ci-publisher`

If the runtime cannot spawn subagents, the principal agent executes the roles sequentially and records the same outputs.

## Required Before Implementation

- Update `project.yaml`.
- Select the component pack from `.portfolio/component-packs/manifest.yaml`.
- Keep `openspec/config.yaml` coherent with the project decision; if OpenSpec is not installed, follow the same artifact graph manually in `sdd/`.
- Fill `sdd/spec.md`.
- Fill `sdd/architecture-decision.md`.
- Fill `sdd/technical-decision.md`.
- Fill `sdd/benchmark-plan.md`.
- Fill `sdd/agent-handoff.md`.
- Fill `sdd/reuse-improvement-review.md`.

## Reuse Priority

Prioritize the skills installed in `.codex/skills/` and `.claude/skills/`, then the local `.portfolio/` snapshot. Use external repositories as references for architecture, organization, schemas, workflows, tests, benchmarks, docs, and DX only when they improve the specific project. If an external pattern is better than the current kit, update the kit or record the improvement in `sdd/reuse-improvement-review.md`.

Do not replace local skills, install external components, or copy code from reference repositories without a recorded decision, license check, attribution, and user approval when machine-level tooling changes.

## Local-First Rule

The default demo must run without paid credentials. Use Docker for the runnable path. Use Kumo for AWS-like local cloud behavior. Real cloud providers must stay behind ports/adapters and must not be imported by domain or use-case code.

## Reuse Improvement Loop

At each major milestone, ask whether this project exposed a reusable improvement for `portfolio-reuse-kit`. Patch low-risk reusable improvements immediately; otherwise record backlog or rejection in `sdd/reuse-improvement-review.md`. Do not leave the review as a template: every ready project must remove placeholder rows and complete the final gate with explicit `[x]` checks.

## Publication Gate

Do not present this repository as portfolio-ready until it has:

- Docker run path
- benchmark command
- benchmark JSON in `benchmarks/results/`
- README opening with project number, claim, and result
- complete `REFERENCES.md`
- complete `sdd/reuse-improvement-review.md` with all final gate checks marked
- passing validation
