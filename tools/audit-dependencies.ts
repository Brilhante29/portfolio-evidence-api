import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const endpoint = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk';
const severityOrder = ['info', 'low', 'moderate', 'high', 'critical'] as const;

export type Severity = (typeof severityOrder)[number];
export type AuditPayload = Record<string, string[]>;

export interface BlockingAdvisory {
  packageName: string;
  id: string;
  severity: Severity;
  title: string;
  url: string;
}

export function buildAuditPayload(lockfile: unknown): AuditPayload {
  if (!isRecord(lockfile) || !isRecord(lockfile.packages)) {
    throw new Error('package-lock.json must contain a packages object');
  }

  const versionsByPackage = new Map<string, Set<string>>();
  for (const [packagePath, value] of Object.entries(lockfile.packages)) {
    if (!packagePath || !isRecord(value) || typeof value.version !== 'string') {
      continue;
    }

    const marker = 'node_modules/';
    const markerIndex = packagePath.lastIndexOf(marker);
    if (markerIndex < 0) {
      continue;
    }

    const packageName = packagePath.slice(markerIndex + marker.length);
    if (!packageName || packageName.includes('/node_modules/')) {
      throw new Error('cannot derive package name from lockfile path: ' + packagePath);
    }

    const versions = versionsByPackage.get(packageName) ?? new Set<string>();
    versions.add(value.version);
    versionsByPackage.set(packageName, versions);
  }

  return Object.fromEntries(
    [...versionsByPackage.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()]),
  );
}

export function decodeAuditBody(body: Uint8Array): unknown {
  const encoded = Buffer.from(body);
  const decoded =
    encoded.length >= 2 && encoded[0] === 0x1f && encoded[1] === 0x8b
      ? gunzipSync(encoded)
      : encoded;

  if (decoded.length === 0) {
    throw new Error('npm audit endpoint returned an empty body');
  }

  return JSON.parse(decoded.toString('utf8')) as unknown;
}

export function findBlockingAdvisories(
  response: unknown,
  minimumSeverity: Severity,
): BlockingAdvisory[] {
  if (!isRecord(response)) {
    throw new Error('npm audit endpoint returned a non-object response');
  }

  const threshold = severityOrder.indexOf(minimumSeverity);
  const blocking: BlockingAdvisory[] = [];

  for (const [packageName, value] of Object.entries(response)) {
    if (!Array.isArray(value)) {
      throw new Error('npm audit advisories for ' + packageName + ' must be an array');
    }

    for (const candidate of value) {
      if (!isRecord(candidate) || typeof candidate.severity !== 'string') {
        throw new Error('npm audit endpoint returned a malformed advisory');
      }

      const severity = parseSeverity(candidate.severity);
      if (severityOrder.indexOf(severity) < threshold) {
        continue;
      }

      blocking.push({
        packageName,
        id: scalarString(candidate.id, 'unknown'),
        severity,
        title: scalarString(candidate.title, 'untitled advisory'),
        url: scalarString(candidate.url, ''),
      });
    }
  }

  return blocking.sort(
    (left, right) =>
      severityOrder.indexOf(right.severity) - severityOrder.indexOf(left.severity) ||
      left.packageName.localeCompare(right.packageName),
  );
}

async function fetchAudit(payload: AuditPayload, attempts = 3): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'identity',
          'content-type': 'application/json',
          'npm-in-ci': process.env.CI ? 'true' : 'false',
        },
        body: JSON.stringify(payload),
      });
      const body = new Uint8Array(await response.arrayBuffer());

      if (!response.ok) {
        throw new Error(
          'npm audit endpoint returned HTTP ' +
            String(response.status) +
            ': ' +
            Buffer.from(body).toString('utf8').slice(0, 200),
        );
      }

      return decodeAuditBody(body);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(
          'audit transport attempt ' +
            String(attempt) +
            ' failed; retrying: ' +
            errorMessage(error),
        );
        await delay(attempt * 1000);
      }
    }
  }

  throw new Error('npm audit transport failed after retries: ' + errorMessage(lastError));
}

async function main(): Promise<void> {
  const minimumSeverity = parseSeverity(
    process.argv.find((argument) => argument.startsWith('--level='))?.slice('--level='.length) ??
      'high',
  );
  const lockfile = JSON.parse(await readFile('package-lock.json', 'utf8')) as unknown;
  const payload = buildAuditPayload(lockfile);
  const response = await fetchAudit(payload);
  const blocking = findBlockingAdvisories(response, minimumSeverity);

  if (blocking.length > 0) {
    for (const advisory of blocking) {
      console.error(
        advisory.severity.toUpperCase() +
          ' ' +
          advisory.packageName +
          ' ' +
          advisory.id +
          ': ' +
          advisory.title +
          (advisory.url ? ' (' + advisory.url + ')' : ''),
      );
    }
    throw new Error(
      String(blocking.length) +
        ' advisory or advisories meet the ' +
        minimumSeverity +
        ' failure threshold',
    );
  }

  console.log(
    'dependency audit passed: ' +
      String(Object.keys(payload).length) +
      ' packages, threshold=' +
      minimumSeverity,
  );
}

function parseSeverity(value: string): Severity {
  if ((severityOrder as readonly string[]).includes(value)) {
    return value as Severity;
  }
  throw new Error('unsupported advisory severity: ' + value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalarString(value: unknown, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const entrypoint = process.argv[1];
if (entrypoint && pathToFileURL(entrypoint).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
