import type { NetworkDiagnosticErrorCode } from './errors';

/**
 * The transport of the active network.
 *
 * - `wifi`, `cellular`, `ethernet`: the physical transport.
 * - `vpn`: Android only, when the OS reports a VPN without an underlying
 *   transport. When the underlying transport is known it is reported here and
 *   `vpn` is set to `true` instead.
 * - `other`: a transport the package does not model (Bluetooth tethering, USB,
 *   loopback, Thread, satellite and similar).
 * - `unknown`: connected, but the transport could not be determined.
 * - `none`: no active network.
 */
export type NetworkType =
  'wifi' | 'cellular' | 'ethernet' | 'vpn' | 'other' | 'unknown' | 'none';

/**
 * Network quality bucket. See `classifyNetworkQuality` and docs/API.md for
 * the exact algorithm.
 */
export type NetworkQuality =
  'excellent' | 'good' | 'fair' | 'poor' | 'offline' | 'unknown';

/** A structured error attached to a diagnostic that could not complete. */
export interface DiagnosticError {
  code: NetworkDiagnosticErrorCode;
  /** Human-readable description. Wording is not part of the stable API. */
  message: string;
}

/**
 * Passive network state reported by the operating system.
 * Reading it never sends a network request.
 *
 * Fields are `undefined` when the current platform has no API that can
 * answer the question. They are never guessed.
 */
export interface NetworkState {
  /** The OS reports a usable network path. This does NOT prove internet access. */
  connected: boolean;
  type: NetworkType;
  /** A VPN is part of the active network. Android only, `undefined` on iOS. */
  vpn?: boolean;
  internet: {
    /**
     * The OS validated internet access on this network
     * (Android `NET_CAPABILITY_VALIDATED`). `undefined` on iOS, which has no
     * public API for this.
     */
    validated?: boolean;
    /**
     * The OS detected a captive portal
     * (Android `NET_CAPABILITY_CAPTIVE_PORTAL`). `undefined` on iOS.
     */
    captivePortal?: boolean;
  };
  conditions: {
    /**
     * Android: the network is metered (`NET_CAPABILITY_NOT_METERED` absent).
     * iOS: `NWPath.isExpensive` (cellular or personal hotspot).
     */
    metered?: boolean;
    /**
     * Android: Data Saver is on and restricts this app.
     * iOS: `NWPath.isConstrained` (Low Data Mode), iOS 13+.
     */
    constrained?: boolean;
  };
}

/** Result of probing the developer-supplied endpoint. */
export interface EndpointResult {
  /** The URL that was probed. */
  url: string;
  /**
   * `true` when an HTTP response was received, whatever its status code.
   * A 500 means the network works and the server has a problem.
   */
  reachable: boolean;
  /** HTTP status code of the last successful sample. */
  statusCode?: number;
  /** Median of `latency.httpsMs` across successful samples. */
  latencyMs?: number;
  /** Number of samples attempted. */
  samples: number;
  /** Number of samples that received an HTTP response. */
  successfulSamples: number;
  /** Error of the last failed sample when no sample succeeded. */
  error?: DiagnosticError;
}

/**
 * Latency measurements for the endpoint probe. Every value is in milliseconds
 * and is the median across successful samples. Each sample uses a fresh
 * connection, so these include connection setup cost.
 */
export interface LatencyMetrics {
  /**
   * Time from starting the HTTPS request to receiving the response headers,
   * on a new connection: DNS + TCP + TLS + server response time.
   */
  httpsMs?: number;
  /**
   * Hostname resolution time as observed by the platform for the probe.
   * May be near zero when the OS resolver cache answered.
   * `undefined` when the platform did not report it.
   */
  dnsMs?: number;
  /** TCP connect time, excluding TLS. */
  tcpConnectMs?: number;
  /** TLS handshake time. */
  tlsHandshakeMs?: number;
}

/** Full diagnostics result. */
export interface NetworkDiagnostics extends NetworkState {
  /** Present only when an `endpoint` option was supplied. */
  endpoint?: EndpointResult;
  /** Empty object when no endpoint was probed. */
  latency: LatencyMetrics;
  quality: NetworkQuality;
  /** Unix epoch milliseconds when the result was produced. */
  timestamp: number;
}

export type ProbeMethod = 'HEAD' | 'GET';

export interface NetworkDiagnosticsOptions {
  /**
   * HTTPS URL to probe, typically your own health-check endpoint.
   * When omitted, no network request is made and only the passive OS state
   * is returned (quality is then `unknown` unless offline).
   */
  endpoint?: string;
  /** Per-request timeout in milliseconds. Default 5000, allowed 500 to 60000. */
  timeoutMs?: number;
  /** HTTP method. Default `HEAD`. The response body is never downloaded. */
  method?: ProbeMethod;
  /**
   * Number of sequential requests to make. The median latency is reported.
   * Default 1, allowed 1 to 5.
   */
  samples?: number;
  /** Override the latency thresholds used for the quality classification. */
  qualityThresholds?: Partial<QualityThresholds>;
}

/**
 * Upper bounds (exclusive) of `latency.httpsMs` for each quality bucket.
 * Anything at or above `fairMs` is `poor`.
 */
export interface QualityThresholds {
  excellentMs: number;
  goodMs: number;
  fairMs: number;
}

export interface QualityInput {
  connected: boolean;
  validated?: boolean;
  captivePortal?: boolean;
  /** Whether the endpoint responded. `undefined` when no probe was made. */
  reachable?: boolean;
  /** Probe latency (https request time) in milliseconds. */
  latencyMs?: number;
}
