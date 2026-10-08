/**
 * Normalized error codes shared by iOS, Android and JavaScript.
 *
 * - `TIMEOUT`: the request did not complete within `timeoutMs`.
 * - `DNS_FAILURE`: the endpoint hostname could not be resolved.
 * - `CONNECTION_FAILURE`: no TCP connection could be established, the
 *   connection was dropped, or the device has no usable network.
 * - `TLS_FAILURE`: the TLS handshake failed (untrusted or mismatched
 *   certificate, protocol error). On public Wi-Fi this often indicates a
 *   captive portal intercepting HTTPS.
 * - `INVALID_ENDPOINT`: the endpoint is not a valid absolute `https://` URL.
 * - `INVALID_OPTIONS`: an option is out of range or of the wrong type.
 * - `DIAGNOSTIC_UNAVAILABLE`: the native module is not linked, or the
 *   platform cannot run the diagnostic.
 * - `UNKNOWN`: any other failure.
 */
export const NETWORK_DIAGNOSTIC_ERROR_CODES = [
  'TIMEOUT',
  'DNS_FAILURE',
  'CONNECTION_FAILURE',
  'TLS_FAILURE',
  'INVALID_ENDPOINT',
  'INVALID_OPTIONS',
  'DIAGNOSTIC_UNAVAILABLE',
  'UNKNOWN',
] as const;

export type NetworkDiagnosticErrorCode =
  (typeof NETWORK_DIAGNOSTIC_ERROR_CODES)[number];

export function isNetworkDiagnosticErrorCode(
  value: unknown
): value is NetworkDiagnosticErrorCode {
  return (
    typeof value === 'string' &&
    (NETWORK_DIAGNOSTIC_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** Maps any native error code string to a known code, defaulting to UNKNOWN. */
export function normalizeErrorCode(value: unknown): NetworkDiagnosticErrorCode {
  return isNetworkDiagnosticErrorCode(value) ? value : 'UNKNOWN';
}

/**
 * Error thrown (as a rejected promise) only for programmer or setup errors:
 * invalid options, or a missing native module. Network failures never throw;
 * they are reported inside the result.
 */
export class NetworkDiagnosticsError extends Error {
  readonly code: NetworkDiagnosticErrorCode;

  constructor(code: NetworkDiagnosticErrorCode, message: string) {
    super(message);
    this.name = 'NetworkDiagnosticsError';
    this.code = code;
  }
}

export function isNetworkDiagnosticsError(
  value: unknown
): value is NetworkDiagnosticsError {
  return value instanceof NetworkDiagnosticsError;
}

/** Converts anything thrown into a NetworkDiagnosticsError. */
export function toNetworkDiagnosticsError(
  value: unknown
): NetworkDiagnosticsError {
  if (value instanceof NetworkDiagnosticsError) {
    return value;
  }
  if (value instanceof Error) {
    const code = normalizeErrorCode((value as { code?: unknown }).code);
    return new NetworkDiagnosticsError(code, value.message);
  }
  return new NetworkDiagnosticsError('UNKNOWN', String(value));
}

export const LINKING_ERROR_MESSAGE =
  "The native module 'NetworkDiagnostics' is not available. Make sure that:\n" +
  '- you rebuilt the app after installing the package\n' +
  "- you ran 'pod install' in the ios directory (iOS)\n" +
  '- you are not running in Expo Go (a development build is required)\n' +
  '- the app runs on iOS or Android (web is not supported)';
