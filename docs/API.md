# API reference

Everything below is exported from `react-native-network-diagnostics`. The API is
**experimental (0.x)**; minor versions may change it.

- [getNetworkDiagnostics](#getnetworkdiagnosticsoptions)
- [getNetworkState](#getnetworkstate)
- [addNetworkStateListener](#addnetworkstatelistenerlistener)
- [useNetworkDiagnostics](#usenetworkdiagnosticsoptions)
- [classifyNetworkQuality](#classifynetworkqualityinput-thresholds)
- [Constants and helpers](#constants-and-helpers)
- [Types](#types)
- [Error codes](#error-codes)
- [Quality classification](#quality-classification)

## `getNetworkDiagnostics(options?)`

```ts
function getNetworkDiagnostics(
  options?: NetworkDiagnosticsOptions
): Promise<NetworkDiagnostics>;
```

Reads the OS network state and, if `endpoint` is set, probes that endpoint.

| Option              | Type                         | Default                                           | Notes                                                                                  |
| ------------------- | ---------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `endpoint`          | `string`                     | none                                              | Absolute `https://` URL. Without it, **no request is sent**.                           |
| `timeoutMs`         | `number`                     | `5000`                                            | Per request, 500 to 60000.                                                             |
| `method`            | `'HEAD' \| 'GET'`            | `'HEAD'`                                          | The body is never downloaded either way.                                               |
| `samples`           | `number`                     | `1`                                               | 1 to 5 sequential requests; medians are reported. Sampling stops at the first failure. |
| `qualityThresholds` | `Partial<QualityThresholds>` | `{ excellentMs: 150, goodMs: 400, fairMs: 1000 }` | See [Quality classification](#quality-classification).                                 |

Behavior:

- Never rejects because of network conditions; failures are in `endpoint.error`.
- Rejects with `NetworkDiagnosticsError`:
  - `INVALID_OPTIONS` for out-of-range or wrongly typed options,
  - `DIAGNOSTIC_UNAVAILABLE` if the native module is not linked.
- A malformed endpoint string does **not** reject; it produces
  `endpoint.error.code === 'INVALID_ENDPOINT'` and no request is sent.
- If the OS reports no connection, no request is sent and
  `endpoint.error.code === 'CONNECTION_FAILURE'`.

```ts
const result = await getNetworkDiagnostics({
  endpoint: 'https://api.example.com/health',
  timeoutMs: 5000,
});

if (result.endpoint && !result.endpoint.reachable) {
  switch (result.endpoint.error?.code) {
    case 'DNS_FAILURE':
      /* hostname could not be resolved */ break;
    case 'TLS_FAILURE':
      /* certificate problem or captive portal */ break;
    case 'TIMEOUT':
      /* no response within timeoutMs */ break;
    case 'CONNECTION_FAILURE':
      /* no route, refused or dropped */ break;
  }
}
```

## `getNetworkState()`

```ts
function getNetworkState(): Promise<NetworkState>;
```

Passive OS state only. Sends no network traffic. Rejects with `DIAGNOSTIC_UNAVAILABLE`
if the native module is missing, or `TIMEOUT` if the OS does not answer within 5 s.

## `addNetworkStateListener(listener)`

```ts
function addNetworkStateListener(
  listener: (state: NetworkState) => void
): () => void;
```

Calls `listener` when the OS reports a change in any exposed value. Passive: no network
traffic. Returns an unsubscribe function (safe to call more than once). Native monitoring
runs only while at least one listener is registered. The first listener usually receives
the current state shortly after subscribing, because both Android
(`registerDefaultNetworkCallback`) and iOS (`NWPathMonitor`) report it on start; later
listeners added while monitoring is running do not get that initial event.

```ts
const unsubscribe = addNetworkStateListener((state) => {
  console.log(state.type, state.connected);
});
// later
unsubscribe();
```

## `useNetworkDiagnostics(options?)`

```ts
function useNetworkDiagnostics(options?: UseNetworkDiagnosticsOptions): {
  diagnostics: NetworkDiagnostics | undefined;
  loading: boolean;
  error: NetworkDiagnosticsError | undefined;
  refresh: () => Promise<NetworkDiagnostics | undefined>;
};
```

Accepts every `getNetworkDiagnostics` option plus:

| Option              | Default | Meaning                                               |
| ------------------- | ------- | ----------------------------------------------------- |
| `runOnMount`        | `true`  | Run once on mount and when diagnostic options change. |
| `monitor`           | `false` | Re-run after OS network changes (debounced). Opt-in.  |
| `monitorDebounceMs` | `1000`  | Quiet period after the last change before re-running. |

- Never polls. Without `monitor`, it runs only on mount, on option change and on
  `refresh()`.
- Options are compared by value, so inline objects do not cause re-runs.
- Results that arrive after unmount, or after a newer run started, are discarded.
- Listeners and timers are removed on unmount.
- In-flight native requests are not cancelled on unmount; they end at `timeoutMs` at the
  latest and their result is ignored.

## `classifyNetworkQuality(input, thresholds?)`

```ts
function classifyNetworkQuality(
  input: QualityInput,
  thresholds?: QualityThresholds
): NetworkQuality;
```

Pure function, exported so that apps can classify their own measurements or test their
UI. `classifyLatency(ms, thresholds?)` and `DEFAULT_QUALITY_THRESHOLDS` are exported too.

## Constants and helpers

| Export                                | Value / signature                                          | Meaning                                                                |
| ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `DEFAULT_TIMEOUT_MS`                  | `5000`                                                     | Default `timeoutMs` per request                                        |
| `MIN_TIMEOUT_MS`                      | `500`                                                      | Smallest accepted `timeoutMs`                                          |
| `MAX_TIMEOUT_MS`                      | `60000`                                                    | Largest accepted `timeoutMs`                                           |
| `MAX_SAMPLES`                         | `5`                                                        | Largest accepted `samples`                                             |
| `DEFAULT_QUALITY_THRESHOLDS`          | `{ excellentMs: 150, goodMs: 400, fairMs: 1000 }` (frozen) | Default latency buckets                                                |
| `NETWORK_DIAGNOSTIC_ERROR_CODES`      | readonly array of the 8 codes                              | See [Error codes](#error-codes)                                        |
| `NetworkDiagnosticsError`             | `class extends Error { code }`                             | Thrown (as a rejection) for invalid options or a missing native module |
| `isNetworkDiagnosticsError(value)`    | `(value: unknown) => value is NetworkDiagnosticsError`     | Type guard                                                             |
| `isNetworkDiagnosticErrorCode(value)` | `(value: unknown) => value is NetworkDiagnosticErrorCode`  | Type guard                                                             |

## Types

```ts
type NetworkType =
  'wifi' | 'cellular' | 'ethernet' | 'vpn' | 'other' | 'unknown' | 'none';
type NetworkQuality =
  'excellent' | 'good' | 'fair' | 'poor' | 'offline' | 'unknown';

interface NetworkState {
  connected: boolean; // OS has a usable path; NOT proof of internet access
  type: NetworkType;
  vpn?: boolean; // Android only
  internet: {
    validated?: boolean; // Android only (NET_CAPABILITY_VALIDATED)
    captivePortal?: boolean; // Android only (NET_CAPABILITY_CAPTIVE_PORTAL)
  };
  conditions: {
    metered?: boolean; // Android metered / iOS isExpensive
    constrained?: boolean; // Android Data Saver / iOS Low Data Mode
  };
}

interface NetworkDiagnostics extends NetworkState {
  endpoint?: EndpointResult; // only when an endpoint was given
  latency: LatencyMetrics; // {} when nothing was probed
  quality: NetworkQuality;
  timestamp: number; // Date.now() when produced
}

interface EndpointResult {
  url: string;
  reachable: boolean; // an HTTP response (any status) was received
  statusCode?: number;
  latencyMs?: number; // = latency.httpsMs
  samples: number; // requests attempted
  successfulSamples: number;
  error?: { code: NetworkDiagnosticErrorCode; message: string };
}

interface LatencyMetrics {
  httpsMs?: number; // request start to response headers, fresh connection
  dnsMs?: number; // hostname resolution for the probe
  tcpConnectMs?: number; // TCP handshake, excluding TLS
  tlsHandshakeMs?: number; // TLS handshake
}
```

### Field semantics

- `undefined` always means "this platform cannot tell", never "false".
- `reachable: true` with `statusCode: 503` means the network works and the server is
  failing. Quality ignores status codes.
- `type: 'vpn'` only appears on Android when the OS reports a VPN without an underlying
  transport. Normally you get the physical transport and `vpn: true`.
- `latency.dnsMs` can be close to 0 when the OS resolver cache answered. It is reported as
  measured, not adjusted.
- All latency values are medians across successful samples, rounded to whole
  milliseconds.

### Measurement caveats

- On Android, `httpsMs` starts at OkHttp's `callStart`, which fires when the request is
  queued. Any time spent waiting in OkHttp's dispatcher queue is therefore included. This
  is negligible unless many probes run at once.
- Probes use the package's own `OkHttpClient` (Android) and `URLSession` (iOS), not your
  app's networking stack. Your app's interceptors, certificate pinning and custom proxy
  settings are not exercised. The Android network security config and iOS App Transport
  Security still apply.
- Right after a network switch, Android can briefly report `internet.validated: false`
  while it re-validates the new network. Without an endpoint, a monitored result may
  therefore show `poor` for a moment.

## Error codes

| Code                     | Meaning                                                   | Typical causes                                                                         |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `TIMEOUT`                | No response within `timeoutMs`                            | Very slow or congested network, server not answering                                   |
| `DNS_FAILURE`            | Hostname could not be resolved                            | Typo in host, DNS outage, offline Wi-Fi                                                |
| `CONNECTION_FAILURE`     | No TCP connection, or it dropped                          | No route, port closed, airplane mode, network lost mid-request                         |
| `TLS_FAILURE`            | TLS handshake failed                                      | Untrusted/expired certificate, captive portal intercepting HTTPS, TLS-inspecting proxy |
| `INVALID_ENDPOINT`       | Not an absolute `https://` URL with a host                | Configuration error                                                                    |
| `INVALID_OPTIONS`        | Option out of range or wrong type (rejects)               | Programmer error                                                                       |
| `DIAGNOSTIC_UNAVAILABLE` | Native module missing or OS service unavailable (rejects) | Not rebuilt after install, Expo Go                                                     |
| `UNKNOWN`                | Anything else                                             |                                                                                        |

`error.message` is a human-readable native description for logs. Its wording is not part
of the API.

## Quality classification

Rules, first match wins:

1. Not connected: `offline`.
2. OS reports a captive portal: `offline` (traffic is held by a sign-in page).
3. A probe was made and no response came back: `poor`.
4. A probe succeeded: bucket by `latency.httpsMs` (below).
5. No probe and the OS says internet is not validated (Android): `poor`.
6. Otherwise: `unknown`. Nothing was measured, so no claim is made.

Latency buckets (defaults, upper bounds exclusive):

| Quality     | `httpsMs`      | Approx. round-trip time |
| ----------- | -------------- | ----------------------- |
| `excellent` | below 150      | below ~50 ms            |
| `good`      | 150 to 399     | ~50 to 130 ms           |
| `fair`      | 400 to 999     | ~130 to 330 ms          |
| `poor`      | 1000 and above | above ~330 ms           |

Why these numbers: a request on a new HTTPS connection needs about three round trips
before the first response byte (TCP handshake, TLS 1.3 handshake, request and response;
TLS 1.2 needs one more), plus DNS and server time. The buckets are therefore about three
times a round-trip budget. `fair` stops at 1 s, the commonly cited limit for keeping a
user's flow of thought (Nielsen's response-time limits). These are **heuristics**: they
measure latency only, not bandwidth, jitter or loss, and they include your server's
response time. Measure your own backend and override the thresholds if needed:

```ts
await getNetworkDiagnostics({
  endpoint,
  qualityThresholds: { excellentMs: 250, goodMs: 600, fairMs: 1500 },
});
```
