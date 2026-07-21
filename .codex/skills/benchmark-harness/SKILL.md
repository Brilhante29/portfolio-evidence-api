---
name: benchmark-harness
description: Add, run, or validate reproducible benchmarks for portfolio repositories. Use when the user asks for benchmark scripts, k6 tests, latency/throughput/recall/cost metrics, benchmark JSON, p95/p99 comparison, or README benchmark tables.
---

# Benchmark Harness

Use benchmarks as product evidence.

1. Prefer one primary metric and at most two secondary metrics.
2. Make the benchmark deterministic: fixed seed, fixed fixture, documented environment.
3. Write machine-readable JSON to `benchmarks/results/`.
4. Put the headline metric in the first screen of README.
5. Use `harness/bench.py` for generic command latency when no domain-specific runner exists.
6. Use k6 for HTTP services and define executable latency, check-rate, and failure-rate thresholds.
7. Keep warm-up or setup traffic outside custom measured metrics. Compute throughput as measured iterations divided by the configured measured duration, not from setup-inclusive k6 rates.
8. When a custom summary reads `p(99)`, include `p(99)` in `summaryTrendStats`; k6 does not include it in the default summary trend set.
9. Run a confirmation benchmark and report variance for the primary metric.
10. Compare old vs new results with `harness/compare_results.py` when optimizing an existing baseline.

Do not report a benchmark without the command needed to reproduce it, its measured window, warm-up policy, result JSON, and failure gates.
