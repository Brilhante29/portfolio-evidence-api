import { readFileSync } from 'node:fs';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { BenchmarkResultV2 } from '../../domain/benchmark-result.js';
import type {
  EvidenceValidator,
  ValidationResult,
} from '../../application/ports/evidence-validator.js';

export class JsonSchemaEvidenceValidator implements EvidenceValidator {
  private readonly validateSchema: ValidateFunction<BenchmarkResultV2>;

  constructor(schemaPath: string) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);
    this.validateSchema = ajv.compile<BenchmarkResultV2>(schema);
  }

  validate(input: unknown): ValidationResult {
    if (this.validateSchema(input)) {
      return { valid: true, evidence: input };
    }

    return {
      valid: false,
      issues: (this.validateSchema.errors ?? []).map(toIssue),
    };
  }
}

function toIssue(error: ErrorObject): { path: string; message: string } {
  const missingProperty =
    error.keyword === 'required' && typeof error.params['missingProperty'] === 'string'
      ? `/${error.params['missingProperty']}`
      : '';
  return {
    path: `${error.instancePath}${missingProperty}` || '/',
    message: error.message ?? error.keyword,
  };
}
