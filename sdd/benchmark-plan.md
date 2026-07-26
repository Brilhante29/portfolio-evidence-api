# Benchmark Plan: portfolio-evidence-api

## Hypothesis

The Node 24/Fastify/SQLite adapter can validate and atomically ingest V2 evidence with stable p95 latency while serving GraphQL reads under the same concurrency.

## Workload

| Mode        | Warmup | Measured | Concurrency | Repeats |
| ----------- | -----: | -------: | ----------: | ------: |
| Calibration |      2 |       10 |           2 |       1 |
| Publishable |     25 |      500 |           8 |       3 |

Each repeat performs measured REST ingestions and measured GraphQL reads through a listening TCP port. Invalid evidence must return 400 and a duplicate run ID must return 409.

## Metrics

| Metric                     | Unit            | Direction | Aggregation              |
| -------------------------- | --------------- | --------- | ------------------------ |
| `ingestion_p95_ms`         | ms              | lower     | p95 of per-repeat p95    |
| `ingestion_throughput_rps` | requests/second | higher    | median repeat throughput |
| `graphql_query_p95_ms`     | ms              | lower     | p95 of per-repeat p95    |

Percentiles use nearest-rank over sorted samples. Any request failure prevents a publishable result.

## Provenance

A full run requires:

- `SOURCE_COMMIT`: lowercase 40-character SHA.
- `CLEAN_TREE=true`.
- `IMAGE_REF` and real `IMAGE_DIGEST`.
- Lockfile, fixture, config, and canonical raw-measurement digests.

Calibration prints JSON but does not write publishable evidence.

## Commands

```bash
docker run --rm portfolio-evidence-api benchmark --calibrate
docker run --name evidence-benchmark \
  -e SOURCE_COMMIT -e CLEAN_TREE=true -e IMAGE_REF -e IMAGE_DIGEST \
  portfolio-evidence-api benchmark
```

## Post Angle

A benchmark is not a screenshot: this API rejects evidence that cannot prove workload, environment, source commit, image, dependencies, and comparability.
