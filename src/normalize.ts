import { normalizeErrorCode } from './errors';
import type {
  DiagnosticError,
  EndpointResult,
  LatencyMetrics,
  NetworkState,
  NetworkType,
} from './types';

/**
 * Converts untyped native payloads into the public types.
 *
 * The native layer is trusted for values but not for shape: unknown strings
 * become `unknown`, non-boolean optionals become `undefined`, and negative or
 * non-finite numbers are dropped. This keeps a native bug from leaking
 * invalid values into application code.
 */

const NETWORK_TYPES: readonly NetworkType[] = [
  'wifi',
  'cellular',
  'ethernet',
  'vpn',
  'other',
  'unknown',
  'none',
];

export function normalizeNetworkType(value: unknown): NetworkType {
  return typeof value === 'string' &&
    (NETWORK_TYPES as readonly string[]).includes(value)
    ? (value as NetworkType)
    : 'unknown';
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalDuration(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function optionalStatusCode(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeNetworkState(native: unknown): NetworkState {
  const raw = asRecord(native);
  const connected = raw.connected === true;
  let type = normalizeNetworkType(raw.type);
  // Keep `connected` and `type` consistent even if the native layer is not.
  if (!connected) {
    type = 'none';
  } else if (type === 'none') {
    type = 'unknown';
  }
  return {
    connected,
    type,
    vpn: optionalBoolean(raw.vpn),
    internet: {
      validated: optionalBoolean(raw.validated),
      captivePortal: optionalBoolean(raw.captivePortal),
    },
    conditions: {
      metered: optionalBoolean(raw.metered),
      constrained: optionalBoolean(raw.constrained),
    },
  };
}

/** One normalized probe sample. */
export interface ProbeSample {
  responded: boolean;
  statusCode?: number;
  totalMs?: number;
  dnsMs?: number;
  tcpConnectMs?: number;
  tlsHandshakeMs?: number;
  error?: DiagnosticError;
}

export function normalizeProbeResult(native: unknown): ProbeSample {
  const raw = asRecord(native);
  const responded = raw.responded === true;
  const sample: ProbeSample = {
    responded,
    statusCode: optionalStatusCode(raw.statusCode),
    totalMs: optionalDuration(raw.totalMs),
    dnsMs: optionalDuration(raw.dnsMs),
    tcpConnectMs: optionalDuration(raw.tcpConnectMs),
    tlsHandshakeMs: optionalDuration(raw.tlsHandshakeMs),
  };
  if (!responded) {
    sample.error = {
      code: normalizeErrorCode(raw.errorCode),
      message:
        typeof raw.errorMessage === 'string' && raw.errorMessage.length > 0
          ? raw.errorMessage
          : 'The endpoint could not be reached',
    };
  }
  return sample;
}

/** Median, rounded to whole milliseconds. `undefined` for an empty list. */
export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
      : (sorted[mid] as number);
  return Math.round(value);
}

function medianOf(
  samples: readonly ProbeSample[],
  key: 'totalMs' | 'dnsMs' | 'tcpConnectMs' | 'tlsHandshakeMs'
): number | undefined {
  const values: number[] = [];
  for (const s of samples) {
    const v = s[key];
    if (typeof v === 'number') {
      values.push(v);
    }
  }
  return median(values);
}

/**
 * Combines samples into the endpoint result and latency metrics.
 * Latency values are medians across samples that received a response.
 */
export function aggregateSamples(
  url: string,
  samples: readonly ProbeSample[]
): { endpoint: EndpointResult; latency: LatencyMetrics } {
  const ok = samples.filter((s) => s.responded);
  const last = samples[samples.length - 1];
  const lastOk = ok[ok.length - 1];
  const latency: LatencyMetrics = {
    httpsMs: medianOf(ok, 'totalMs'),
    dnsMs: medianOf(ok, 'dnsMs'),
    tcpConnectMs: medianOf(ok, 'tcpConnectMs'),
    tlsHandshakeMs: medianOf(ok, 'tlsHandshakeMs'),
  };
  const endpoint: EndpointResult = {
    url,
    reachable: ok.length > 0,
    statusCode: lastOk?.statusCode,
    latencyMs: latency.httpsMs,
    samples: samples.length,
    successfulSamples: ok.length,
  };
  if (ok.length === 0 && last?.error) {
    endpoint.error = last.error;
  }
  return { endpoint, latency };
}
