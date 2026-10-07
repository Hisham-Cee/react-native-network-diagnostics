import type { NetworkQuality, QualityInput, QualityThresholds } from './types';

/**
 * Default latency thresholds, applied to `latency.httpsMs`: the time to
 * receive response headers for an HTTPS request on a NEW connection.
 *
 * A fresh HTTPS request costs about 3 network round trips before the first
 * response byte (TCP handshake, TLS 1.3 handshake, request/response; TLS 1.2
 * adds one more), plus DNS and server time. The thresholds are therefore
 * roughly 3x a round-trip-time budget:
 *
 * | Bucket    | httpsMs     | Approx. RTT | Reasoning                                   |
 * |-----------|-------------|-------------|---------------------------------------------|
 * | excellent | < 150       | < ~50 ms    | Nearby server on good Wi-Fi/ethernet/5G.    |
 * | good      | 150 to 399  | ~50-130 ms  | Typical healthy 4G/LTE or distant server.   |
 * | fair      | 400 to 999  | ~130-330 ms | Noticeable delay, still under the ~1 s      |
 * |           |             |             | limit where users keep their flow of        |
 * |           |             |             | thought (Nielsen response-time limits).     |
 * | poor      | >= 1000     | > ~330 ms   | Every new request takes over a second.      |
 *
 * These numbers are heuristics, not standards. They measure latency only, not
 * bandwidth, jitter or packet loss. Override them with `qualityThresholds`
 * when your backend or audience needs different budgets.
 */
export const DEFAULT_QUALITY_THRESHOLDS: Readonly<QualityThresholds> =
  Object.freeze({
    excellentMs: 150,
    goodMs: 400,
    fairMs: 1000,
  });

/**
 * Merges partial overrides into the defaults and validates the result.
 * Throws a RangeError when thresholds are not positive and strictly ascending.
 */
export function resolveQualityThresholds(
  overrides?: Partial<QualityThresholds>
): QualityThresholds {
  const merged: QualityThresholds = {
    ...DEFAULT_QUALITY_THRESHOLDS,
    ...stripUndefined(overrides),
  };
  const { excellentMs, goodMs, fairMs } = merged;
  const valid =
    [excellentMs, goodMs, fairMs].every((v) => Number.isFinite(v) && v > 0) &&
    excellentMs < goodMs &&
    goodMs < fairMs;
  if (!valid) {
    throw new RangeError(
      'qualityThresholds must be positive numbers with excellentMs < goodMs < fairMs'
    );
  }
  return merged;
}

/**
 * Classifies network quality. Rules are applied in order; the first match wins:
 *
 * 1. `connected === false`                       -> `offline`
 * 2. `captivePortal === true`                    -> `offline`
 *    (the OS reports that traffic is held by a sign-in page)
 * 3. A probe was made and `reachable === false`  -> `poor`
 *    (connected, but the endpoint could not be reached; the error code
 *    tells you whether DNS, TCP, TLS or a timeout failed)
 * 4. A probe was made and latency is known       -> latency buckets
 * 5. No probe and `validated === false`          -> `poor`
 *    (Android reports the network has no validated internet access)
 * 6. Otherwise                                   -> `unknown`
 *    (nothing was measured, so no quality claim is made)
 *
 * HTTP status codes are deliberately ignored: a 500 response proves the
 * network path works.
 */
export function classifyNetworkQuality(
  input: QualityInput,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): NetworkQuality {
  if (!input.connected) {
    return 'offline';
  }
  if (input.captivePortal === true) {
    return 'offline';
  }
  if (input.reachable === false) {
    return 'poor';
  }
  if (
    input.reachable === true &&
    typeof input.latencyMs === 'number' &&
    Number.isFinite(input.latencyMs) &&
    input.latencyMs >= 0
  ) {
    return classifyLatency(input.latencyMs, thresholds);
  }
  if (input.validated === false) {
    return 'poor';
  }
  return 'unknown';
}

/** Maps a latency value to a bucket using the given thresholds. */
export function classifyLatency(
  latencyMs: number,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS
): Exclude<NetworkQuality, 'offline' | 'unknown'> {
  if (latencyMs < thresholds.excellentMs) {
    return 'excellent';
  }
  if (latencyMs < thresholds.goodMs) {
    return 'good';
  }
  if (latencyMs < thresholds.fairMs) {
    return 'fair';
  }
  return 'poor';
}

function stripUndefined<T extends object>(value: T | undefined): Partial<T> {
  const out: Partial<T> = {};
  if (!value) {
    return out;
  }
  for (const key of Object.keys(value) as Array<keyof T>) {
    if (value[key] !== undefined) {
      out[key] = value[key];
    }
  }
  return out;
}
