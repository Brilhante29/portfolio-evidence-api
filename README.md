# #31 portfolio-evidence-api

**Status:** scaffold

**Proves:** <one sentence claim>

**Benchmark:** `<metric> = pending <unit>`.

**Control:** `.portfolio-control/` is the project-level map of reuse, decisions, agent handoffs, critical path, and quality gates.

## Run

```bash
docker build -t portfolio-evidence-api .
docker run --rm portfolio-evidence-api
```

## Benchmark

```bash
docker run --rm portfolio-evidence-api benchmark
```

| Metric | Value | Unit | Notes |
|---|---:|---|---|
| <metric> | pending | <unit> | first reproducible baseline pending |

## Architecture

Defined in `sdd/spec.md` before implementation.

## Reproduce

1. Clone the repository.
2. Build the Docker image.
3. Run the benchmark command.
4. Compare the generated JSON in `benchmarks/results/`.

## References

See `REFERENCES.md`.