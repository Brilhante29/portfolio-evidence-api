# Benchmark Proof

Status: local publishable baseline validated; GitHub publication pending.

The clean-source Node 24 Docker run produced a V2 artifact with zero failures:

- ingestion p95: 40.201 ms
- ingestion throughput: 438.148 requests/second
- GraphQL p95: 24.119 ms

The run used commit `14e43efd63d780d21d71ca2d7ad6b0dde6bcdd0a`, image `sha256:09673d4874d540778ea5562d98097802d9636da6eb014dd2bae6df8583ccc6f1`, 25 warmups, 500 measured requests, concurrency 8, and 3 repeats. The signed-by-content artifact is `benchmarks/results/latest.json`; results are comparable only when the `comparability_key` matches.
