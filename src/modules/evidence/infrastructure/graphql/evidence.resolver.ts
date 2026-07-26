import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { InvalidQueryError } from '../../application/errors.js';
import { QueryEvidence } from '../../application/use-cases/query-evidence.js';
import {
  BenchmarkComparisonType,
  BenchmarkRunConnectionType,
  BenchmarkRunType,
  EvidenceStatusType,
  toComparison,
  toRun,
  toRunConnection,
} from './evidence.graphql-types.js';

@Resolver()
export class EvidenceResolver {
  constructor(private readonly queries: QueryEvidence) {}

  @Query(() => BenchmarkRunType, { nullable: true })
  benchmarkRun(
    @Args('runId', { type: () => ID }) runId: string,
  ): Promise<BenchmarkRunType | undefined> {
    return this.mapErrors(async () => {
      const run = await this.queries.benchmarkRun(runId);
      return run ? toRun(run) : undefined;
    });
  }

  @Query(() => BenchmarkRunConnectionType)
  benchmarkRuns(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 50 })
    first: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
    @Args('project', { type: () => String, nullable: true }) project?: string,
    @Args('benchmarkId', { type: () => String, nullable: true })
    benchmarkId?: string,
    @Args('comparabilityKey', { type: () => String, nullable: true })
    comparabilityKey?: string,
    @Args('status', { type: () => EvidenceStatusType, nullable: true })
    status?: EvidenceStatusType,
  ): Promise<BenchmarkRunConnectionType> {
    return this.mapErrors(async () =>
      toRunConnection(
        await this.queries.benchmarkRuns({
          first,
          offset,
          ...(project ? { project } : {}),
          ...(benchmarkId ? { benchmarkId } : {}),
          ...(comparabilityKey ? { comparabilityKey } : {}),
          ...(status ? { status } : {}),
        }),
      ),
    );
  }

  @Query(() => BenchmarkComparisonType)
  compareBenchmarkRuns(
    @Args('runIds', { type: () => [ID] }) runIds: string[],
  ): Promise<BenchmarkComparisonType> {
    return this.mapErrors(async () =>
      toComparison(await this.queries.compareBenchmarkRuns(runIds)),
    );
  }

  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof InvalidQueryError) {
        throw new GraphQLError(error.message, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
      throw error;
    }
  }
}
