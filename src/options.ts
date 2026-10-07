import { NetworkDiagnosticsError } from './errors';
import { resolveQualityThresholds } from './quality';
import type {
  DiagnosticError,
  NetworkDiagnosticsOptions,
  ProbeMethod,
  QualityThresholds,
} from './types';

export const DEFAULT_TIMEOUT_MS = 5000;
export const MIN_TIMEOUT_MS = 500;
export const MAX_TIMEOUT_MS = 60000;
export const DEFAULT_SAMPLES = 1;
export const MAX_SAMPLES = 5;
export const DEFAULT_METHOD: ProbeMethod = 'HEAD';
const MAX_URL_LENGTH = 2048;

export interface ResolvedOptions {
  endpoint?: string;
  timeoutMs: number;
  method: ProbeMethod;
  samples: number;
  thresholds: QualityThresholds;
}

/**
 * Validates options and fills in defaults.
 * Throws NetworkDiagnosticsError('INVALID_OPTIONS') for programmer errors.
 * The endpoint string itself is NOT validated here: an invalid endpoint is a
 * runtime condition reported in the result (see validateEndpoint).
 */
export function resolveOptions(
  options: NetworkDiagnosticsOptions = {}
): ResolvedOptions {
  if (options === null || typeof options !== 'object') {
    throw invalid('options must be an object');
  }

  const { endpoint, timeoutMs, method, samples, qualityThresholds } = options;

  if (endpoint !== undefined && typeof endpoint !== 'string') {
    throw invalid('endpoint must be a string');
  }

  const resolvedTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (
    typeof resolvedTimeout !== 'number' ||
    !Number.isFinite(resolvedTimeout) ||
    resolvedTimeout < MIN_TIMEOUT_MS ||
    resolvedTimeout > MAX_TIMEOUT_MS
  ) {
    throw invalid(
      `timeoutMs must be a number between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`
    );
  }

  const resolvedMethod = method ?? DEFAULT_METHOD;
  if (resolvedMethod !== 'HEAD' && resolvedMethod !== 'GET') {
    throw invalid("method must be 'HEAD' or 'GET'");
  }

  const resolvedSamples = samples ?? DEFAULT_SAMPLES;
  if (
    typeof resolvedSamples !== 'number' ||
    !Number.isInteger(resolvedSamples) ||
    resolvedSamples < 1 ||
    resolvedSamples > MAX_SAMPLES
  ) {
    throw invalid(`samples must be an integer between 1 and ${MAX_SAMPLES}`);
  }

  let thresholds: QualityThresholds;
  try {
    thresholds = resolveQualityThresholds(qualityThresholds);
  } catch (e) {
    throw invalid(e instanceof Error ? e.message : String(e));
  }

  return {
    endpoint,
    timeoutMs: Math.round(resolvedTimeout),
    method: resolvedMethod,
    samples: resolvedSamples,
    thresholds,
  };
}

export type EndpointValidation =
  { valid: true; url: string } | { valid: false; error: DiagnosticError };

/**
 * Checks that the endpoint is an absolute https:// URL with a host, without
 * whitespace or embedded credentials. Plain http:// is rejected: iOS App
 * Transport Security and the Android cleartext policy block it by default,
 * and a diagnostic should reflect what production traffic does.
 *
 * Intentionally does not rely on the global URL class, which is incomplete
 * in some React Native versions. The native side parses the URL again.
 */
export function validateEndpoint(endpoint: string): EndpointValidation {
  const url = endpoint.trim();
  if (url.length === 0) {
    return invalidEndpoint('endpoint is empty');
  }
  if (url.length > MAX_URL_LENGTH) {
    return invalidEndpoint(
      `endpoint is longer than ${MAX_URL_LENGTH} characters`
    );
  }
  if (/\s/.test(url)) {
    return invalidEndpoint('endpoint contains whitespace');
  }
  const match = /^https:\/\/([^/?#]*)/i.exec(url);
  if (!match) {
    return invalidEndpoint('endpoint must be an absolute https:// URL');
  }
  const authority = match[1] ?? '';
  if (authority.includes('@')) {
    return invalidEndpoint('endpoint must not contain credentials');
  }
  const host = authority.replace(/:\d*$/, '');
  if (host.length === 0 || host.startsWith('.') || host.endsWith('.')) {
    return invalidEndpoint('endpoint has no valid host');
  }
  const port = /:(\d*)$/.exec(authority)?.[1];
  if (port !== undefined) {
    const n = Number(port);
    if (port.length === 0 || !Number.isInteger(n) || n < 1 || n > 65535) {
      return invalidEndpoint('endpoint has an invalid port');
    }
  }
  return { valid: true, url };
}

function invalidEndpoint(message: string): EndpointValidation {
  return { valid: false, error: { code: 'INVALID_ENDPOINT', message } };
}

function invalid(message: string): NetworkDiagnosticsError {
  return new NetworkDiagnosticsError('INVALID_OPTIONS', message);
}
