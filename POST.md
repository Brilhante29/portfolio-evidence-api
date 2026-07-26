# Benchmark Evidence Is A Product Boundary

Most portfolio benchmarks end as a number in a README. This repository treats the number as data with a contract.

The service accepts benchmark-result-v2 evidence only when workload, environment, source commit, image digest, dependency lock, and comparability are present. REST commands quarantine or decide publication idempotently; GraphQL consumers can read and compare runs without owning write policy.

The post becomes publishable when `benchmarks/results/latest.json` contains the clean Node 24 Docker baseline. The useful comparison is not Node versus another language yet. It is unverifiable output versus evidence that another machine can reject, reproduce, and compare.
