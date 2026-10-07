import NativeNetworkDiagnostics, {
  type Spec,
} from './NativeNetworkDiagnostics';
import {
  LINKING_ERROR_MESSAGE,
  NetworkDiagnosticsError,
  toNetworkDiagnosticsError,
} from './errors';
import {
  aggregateSamples,
  normalizeNetworkState,
  normalizeProbeResult,
  type ProbeSample,
} from './normalize';
import { resolveOptions, validateEndpoint } from './options';
import { classifyNetworkQuality } from './quality';
import { JS_TIMEOUT_GRACE_MS, withTimeout } from './timeout';
import type {
  EndpointResult,
  LatencyMetrics,
  NetworkDiagnostics,
  NetworkDiagnosticsOptions,
  NetworkState,
} from './types';

/** Upper bound for the passive state read, which should return in microseconds. */
const STATE_TIMEOUT_MS = 5000;

function getNativeModule(): Spec {
  if (!NativeNetworkDiagnostics) {
    throw new NetworkDiagnosticsError(
      'DIAGNOSTIC_UNAVAILABLE',
      LINKING_ERROR_MESSAGE
    );
  }
  return NativeNetworkDiagnostics;
}

/**
 * Reads the passive network state from the OS. Sends no network traffic.
 *
 * Rejects with NetworkDiagnosticsError only when the native module is
 * missing or the platform call fails.
 */
export async function getNetworkState(): Promise<NetworkState> {
  const native = getNativeModule();
  const timedOut = Symbol('timeout');
  let raw: unknown;
  try {
    raw = await withTimeout<unknown>(
      native.getNetworkState(),
      STATE_TIMEOUT_MS,
      () => timedOut
    );
  } catch (error) {
    throw toNetworkDiagnosticsError(error);
  }
  if (raw === timedOut) {
    throw new NetworkDiagnosticsError(
      'TIMEOUT',
      'Reading the network state from the OS timed out'
    );
  }
  return normalizeNetworkState(raw);
}

async function probeOnce(
  native: Spec,
  url: string,
  method: string,
  timeoutMs: number
): Promise<ProbeSample> {
  const timedOut = Symbol('timeout');
  try {
    const raw = await withTimeout<unknown>(
      native.probeEndpoint(url, method, timeoutMs),
      timeoutMs + JS_TIMEOUT_GRACE_MS,
      () => timedOut
    );
    if (raw === timedOut) {
      return {
        responded: false,
        error: {
          code: 'TIMEOUT',
          message: `No response within ${timeoutMs} ms`,
        },
      };
    }
    return normalizeProbeResult(raw);
  } catch (error) {
    const e = toNetworkDiagnosticsError(error);
    return { responded: false, error: { code: e.code, message: e.message } };
  }
}

/**
 * Runs the network diagnostics.
 *
 * Without `options.endpoint`, this only reads the OS state (no network
 * traffic). With an endpoint, it sends `samples` sequential HTTPS requests
 * (default 1) to that URL and nowhere else.
 *
 * Network failures never reject: they are reported in `endpoint.error` and
 * reflected in `quality`. The promise rejects only for invalid options
 * (`INVALID_OPTIONS`) or a missing native module (`DIAGNOSTIC_UNAVAILABLE`).
 */
export async function getNetworkDiagnostics(
  options?: NetworkDiagnosticsOptions
): Promise<NetworkDiagnostics> {
  const resolved = resolveOptions(options);
  const native = getNativeModule();
  const state = await getNetworkState();

  let endpoint: EndpointResult | undefined;
  let latency: LatencyMetrics = {};

  if (resolved.endpoint !== undefined) {
    const validation = validateEndpoint(resolved.endpoint);
    if (!validation.valid) {
      endpoint = {
        url: resolved.endpoint,
        reachable: false,
        samples: 0,
        successfulSamples: 0,
        error: validation.error,
      };
    } else if (!state.connected) {
      // No route: the request would fail immediately. Do not send it.
      endpoint = {
        url: validation.url,
        reachable: false,
        samples: 0,
        successfulSamples: 0,
        error: {
          code: 'CONNECTION_FAILURE',
          message: 'The device has no active network connection',
        },
      };
    } else {
      const samples: ProbeSample[] = [];
      for (let i = 0; i < resolved.samples; i++) {
        const sample = await probeOnce(
          native,
          validation.url,
          resolved.method,
          resolved.timeoutMs
        );
        samples.push(sample);
        if (!sample.responded) {
          // Repeating a failed request adds traffic and delay without new information.
          break;
        }
      }
      const aggregated = aggregateSamples(validation.url, samples);
      endpoint = aggregated.endpoint;
      latency = aggregated.latency;
    }
  }

  const probed = endpoint !== undefined && endpoint.samples > 0;
  const quality = classifyNetworkQuality(
    {
      connected: state.connected,
      validated: state.internet.validated,
      captivePortal: state.internet.captivePortal,
      reachable: probed ? endpoint?.reachable : undefined,
      latencyMs: latency.httpsMs,
    },
    resolved.thresholds
  );

  return {
    ...state,
    endpoint,
    latency,
    quality,
    timestamp: Date.now(),
  };
}

export type NetworkStateListener = (state: NetworkState) => void;

let activeListeners = 0;

/**
 * Subscribes to OS network state changes (passive, no network traffic).
 * Native monitoring starts with the first listener and stops when the last
 * one is removed. Consecutive identical states are not delivered twice.
 *
 * Returns an unsubscribe function. Calling it more than once is safe.
 * Throws NetworkDiagnosticsError('DIAGNOSTIC_UNAVAILABLE') when the native
 * module is missing.
 */
export function addNetworkStateListener(
  listener: NetworkStateListener
): () => void {
  if (typeof listener !== 'function') {
    throw new NetworkDiagnosticsError(
      'INVALID_OPTIONS',
      'listener must be a function'
    );
  }
  const native = getNativeModule();
  let lastKey: string | undefined;
  const subscription = native.onNetworkStateChange((raw) => {
    const state = normalizeNetworkState(raw);
    const key = JSON.stringify(state);
    if (key === lastKey) {
      return;
    }
    lastKey = key;
    listener(state);
  });

  activeListeners += 1;
  if (activeListeners === 1) {
    native.startMonitoring();
  }

  let removed = false;
  return () => {
    if (removed) {
      return;
    }
    removed = true;
    subscription.remove();
    activeListeners = Math.max(0, activeListeners - 1);
    if (activeListeners === 0) {
      native.stopMonitoring();
    }
  };
}

/** @internal Test helper. */
export function __getActiveListenerCount(): number {
  return activeListeners;
}
