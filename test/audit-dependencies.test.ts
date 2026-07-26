import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  buildAuditPayload,
  decodeAuditBody,
  findBlockingAdvisories,
} from '../tools/audit-dependencies.js';

describe('dependency audit transport', () => {
  it('builds a deterministic payload from nested and scoped lockfile entries', () => {
    const payload = buildAuditPayload({
      packages: {
        '': { version: '0.1.0' },
        'node_modules/alpha': { version: '2.0.0' },
        'node_modules/parent/node_modules/alpha': { version: '1.0.0' },
        'node_modules/@scope/beta': { version: '3.0.0' },
      },
    });

    expect(payload).toEqual({
      '@scope/beta': ['3.0.0'],
      alpha: ['1.0.0', '2.0.0'],
    });
  });

  it('decodes an identity JSON response', () => {
    expect(decodeAuditBody(Buffer.from('{"alpha":[]}'))).toEqual({ alpha: [] });
  });

  it('defensively decodes a gzip body when the transport omits its encoding header', () => {
    expect(decodeAuditBody(gzipSync(Buffer.from('{"alpha":[]}')))).toEqual({ alpha: [] });
  });

  it('blocks only advisories at or above the configured severity', () => {
    const result = findBlockingAdvisories(
      {
        alpha: [
          { id: 1, severity: 'moderate', title: 'moderate issue', url: 'https://example.test/1' },
          { id: 2, severity: 'high', title: 'high issue', url: 'https://example.test/2' },
        ],
        beta: [
          { id: 3, severity: 'critical', title: 'critical issue', url: 'https://example.test/3' },
        ],
      },
      'high',
    );

    expect(result.map((item) => [item.packageName, item.severity])).toEqual([
      ['beta', 'critical'],
      ['alpha', 'high'],
    ]);
  });
});
