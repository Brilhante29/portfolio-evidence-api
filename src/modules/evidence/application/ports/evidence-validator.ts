import type { BenchmarkResultV2 } from '../../domain/benchmark-result.js';
import type { ValidationIssue } from '../errors.js';

export type ValidationResult =
  | { readonly valid: true; readonly evidence: BenchmarkResultV2 }
  | { readonly valid: false; readonly issues: readonly ValidationIssue[] };

export interface EvidenceValidator {
  validate(input: unknown): ValidationResult;
}
