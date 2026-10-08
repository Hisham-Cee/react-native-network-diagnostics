/**
 * TurboModule specification for react-native-network-diagnostics.
 *
 * React Native Codegen reads this file (see `codegenConfig` in package.json)
 * and generates the native interfaces that the Kotlin (Android) and
 * Objective-C++/Swift (iOS) implementations conform to.
 *
 * This is the raw native contract. Application code should use the typed
 * wrappers exported from `index.ts` instead of calling this module directly.
 */
import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

/**
 * Passive network state as reported by the operating system.
 * No network traffic is generated to produce this object.
 *
 * Optional fields are omitted (not `false`) when the platform has no API
 * that can answer the question.
 */
export type NativeNetworkState = {
  /** The OS reports a usable network path (Android: active network exists, iOS: path satisfied). */
  connected: boolean;
  /** One of: wifi, cellular, ethernet, vpn, other, unknown, none. */
  type: string;
  /** A VPN transport is part of the active network. Android only. */
  vpn?: boolean;
  /** The OS has validated internet access on this network. Android only. */
  validated?: boolean;
  /** The OS detected a captive portal on this network. Android only. */
  captivePortal?: boolean;
  /** Android: network is metered. iOS: NWPath.isExpensive. */
  metered?: boolean;
  /** Android: Data Saver restricts this app. iOS: NWPath.isConstrained (Low Data Mode). */
  constrained?: boolean;
};

/**
 * Result of a single HTTPS request to a developer-supplied endpoint.
 * The native side never rejects for network failures; it reports them here.
 */
export type NativeProbeResult = {
  /** An HTTP response (any status code) was received. */
  responded: boolean;
  statusCode?: number;
  /** Request start to response headers received, on a fresh connection. */
  totalMs?: number;
  /** Hostname resolution time, when the platform reports it for this request. */
  dnsMs?: number;
  /** TCP connection establishment time (excluding TLS). */
  tcpConnectMs?: number;
  /** TLS handshake time. */
  tlsHandshakeMs?: number;
  /** Normalized error code (see errors.ts) when `responded` is false. */
  errorCode?: string;
  /** Human-readable native error description. Not part of the stable API. */
  errorMessage?: string;
};

export interface Spec extends TurboModule {
  /** Reads the current OS network state. Never performs network I/O. */
  getNetworkState(): Promise<NativeNetworkState>;

  /**
   * Performs one HTTPS request to `url` with the given method and timeout and
   * resolves with timing information. Redirects are not followed and the
   * response body is not downloaded.
   */
  probeEndpoint(
    url: string,
    method: string,
    timeoutMs: number
  ): Promise<NativeProbeResult>;

  /** Starts observing OS network changes. Reference counted on the JS side. */
  startMonitoring(): void;

  /** Stops observing OS network changes. */
  stopMonitoring(): void;

  /** Emitted when the passive network state changes while monitoring. */
  readonly onNetworkStateChange: CodegenTypes.EventEmitter<NativeNetworkState>;
}

/**
 * `get` (not `getEnforcing`) so that importing the package never throws.
 * A missing native module is reported as a structured error at call time.
 */
export default TurboModuleRegistry.get<Spec>('NetworkDiagnostics');
