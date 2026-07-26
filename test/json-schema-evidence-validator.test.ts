import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonSchemaEvidenceValidator } from '../src/modules/evidence/infrastructure/validation/json-schema-evidence-validator.js';

const contracts = join(process.cwd(), 'contracts');
const validator = new JsonSchemaEvidenceValidator(
  join(contracts, 'benchmark-result-v2.schema.json'),
);

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(contracts, 'fixtures', name), 'utf8')) as unknown;
}

describe('JsonSchemaEvidenceValidator', () => {
  it('accepts the canonical valid v2 fixture', () => {
    expect(validator.validate(fixture('benchmark-result-v2.valid.json'))).toMatchObject({
      valid: true,
    });
  });

  it('rejects the canonical invalid v2 fixture with useful paths', () => {
    const result = validator.validate(fixture('benchmark-result-v2.invalid.json'));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThan(3);
      expect(result.issues.some((issue) => issue.path.includes('run_id'))).toBe(true);
    }
  });
});
