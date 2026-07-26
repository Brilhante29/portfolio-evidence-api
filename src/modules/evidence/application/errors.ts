export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class InvalidEvidenceError extends Error {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super('Benchmark evidence does not satisfy the v2 contract.');
    this.name = 'InvalidEvidenceError';
  }
}

export class DuplicateRunError extends Error {
  constructor(readonly runId: string) {
    super(`Benchmark run '${runId}' already exists.`);
    this.name = 'DuplicateRunError';
  }
}

export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQueryError';
  }
}

export class RunNotFoundError extends Error {
  constructor(readonly runId: string) {
    super(`Benchmark run '${runId}' was not found.`);
    this.name = 'RunNotFoundError';
  }
}

export class OperationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationConflictError';
  }
}

export class PublicationBlockedError extends Error {
  constructor(readonly blockers: readonly string[]) {
    super('Benchmark evidence is not ready for publication.');
    this.name = 'PublicationBlockedError';
  }
}

export class InvalidOperationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationInputError';
  }
}
