# Architecture

## Why this package exists alongside NetInfo

NetInfo answers _"what network are we connected to?"_. This package answers _"how healthy
is the connection, and why might networking be failing?"_. It reports the OS view of the
network (validated, captive portal, metered, constrained) together with a measured HTTPS
request to the app's own backend, broken into DNS, TCP and TLS phases, with failures
normalized into a small set of error codes. Apps that already use NetInfo can keep it.

## Layers

```
App code
  │  getNetworkDiagnostics(), getNetworkState(), addNetworkStateListener(),
  │  useNetworkDiagnostics(), classifyNetworkQuality()
  ▼
TypeScript wrapper (src/)
  │  option validation, endpoint validation, sampling, median,
  │  JS timeout guard, result normalization, quality classification
  ▼
TurboModule spec (src/NativeNetworkDiagnostics.ts)  ── React Native Codegen ──┐
  │                                                                           │
  ├──► Android: NetworkDiagnosticsModule.kt (extends generated              │
  │      NativeNetworkDiagnosticsSpec)                                       │
  │        NetworkInspector  → ConnectivityManager / NetworkCapabilities     │
  │        EndpointProber    → OkHttp + EventListener                        │
  │        NetworkStateMapper, ProbeErrorMapper, ProbeTimings (pure, tested) │
  │                                                                           │
  └──► iOS: NetworkDiagnostics.mm (conforms to generated protocol,           │
         inherits NativeNetworkDiagnosticsSpecBase for events)  ◄────────────┘
           → NetworkDiagnosticsImpl.swift
               NWPathMonitor, URLSession + URLSessionTaskMetrics
               Core/*.swift (pure, tested with SwiftPM)
```

## Key decisions

### New Architecture only

The module is a TurboModule generated from a TypeScript spec. There is no
`RCTBridgeModule`/`ReactContextBaseJavaModule` hand-written legacy path. React Native
0.82+ only runs the New Architecture, and 0.76 to 0.81 enable it by default.

The spec uses `CodegenTypes.EventEmitter` for the network-change event. Codegen
understands the `CodegenTypes.` qualified form from React Native 0.80, which sets the
minimum peer dependency (`react-native >= 0.80.0`).

### Swift behind a thin Objective-C++ file

A TurboModule on iOS must conform to a Codegen-generated Objective-C++ protocol and
return a C++ JSI object from `getTurboModule:`. Swift cannot do either directly. The
`.mm` file is therefore a thin adapter (about 90 lines) and all logic is in Swift.
`create-react-native-library` 0.63.1 only offers `kotlin-objc` for TurboModules; the Swift
files were added on top of that template.

### No C++

Nothing requires shared C++: both platforms have first-class networking APIs, and the
data crossing the boundary is small. Avoiding C++ keeps the build simple.

### No default endpoint

Without `endpoint`, the package sends **no network traffic at all**. A default
third-party URL would quietly send the user's IP address to that third party on every
diagnostic. Apps that want a public connectivity check can pass one explicitly (the
example app offers Google's `generate_204` behind a button).

### HTTPS only

`http://` endpoints are rejected with `INVALID_ENDPOINT`. iOS App Transport Security and
the Android cleartext policy block plain HTTP by default, so an HTTP probe would measure a
configuration problem rather than the network.

### Fresh connection per probe

Each probe uses a new connection (Android: a dedicated OkHttp connection pool with zero
idle connections; iOS: a new ephemeral `URLSession`). This makes every sample include DNS,
TCP and TLS, so samples are comparable and the phase timings are present. It also means
`httpsMs` is higher than the latency of a request on an already-open connection; the
quality thresholds account for that (see [API.md](API.md#quality-classification)).

### No redirects, no body

Redirects are not followed: a `3xx` is a valid response and on public Wi-Fi often a sign
of a captive portal. The response body is never downloaded (Android closes the response
after headers; iOS cancels the task in `didReceiveResponse`). `HEAD` is the default
method; `GET` is available for servers that reject `HEAD`.

### Errors are data

Network failures never reject a promise. They appear in `endpoint.error` with a normalized
code. Promises reject only for programmer or setup errors (`INVALID_OPTIONS`,
`DIAGNOSTIC_UNAVAILABLE`). The native module is looked up with
`TurboModuleRegistry.get` (not `getEnforcing`) so importing the package never throws.

### Timeouts at two levels

Native code enforces `timeoutMs` (OkHttp `callTimeout` plus connect/read/write timeouts;
URLSession request and resource timeouts). The JavaScript wrapper adds a guard of
`timeoutMs + 2000 ms` so that a promise can never hang even if native code misbehaves.
The passive state read has its own 5 s guard (iOS native: 2 s).

### Monitoring is passive and reference counted

`addNetworkStateListener` starts native monitoring for the first listener and stops it
after the last one is removed. Android uses `registerDefaultNetworkCallback`; iOS uses
`NWPathMonitor`. Both sides drop updates that do not change any exposed value (Android
fires capability callbacks for signal strength changes, for example). The hook only runs
an endpoint probe after a debounced, real state change, and only when `monitor: true`.

### Pure, testable mapping code

Platform types (`NetworkCapabilities`, `NWPath`, `URLSessionTaskMetrics`, OkHttp events)
are converted into plain data first. Mapping, error conversion and timing math operate on
that plain data and are unit-tested on the JVM (JUnit) and with SwiftPM (XCTest) without
a device.

## What is measured

| Value                    | Android source                                                                       | iOS source                                               |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `connected`              | Active network exists and is not suspended (`NET_CAPABILITY_NOT_SUSPENDED`, API 28+) | `NWPath.status == .satisfied`                            |
| `type`                   | `NetworkCapabilities.hasTransport`                                                   | `NWPath.usesInterfaceType`                               |
| `vpn`                    | `TRANSPORT_VPN`                                                                      | not available                                            |
| `internet.validated`     | `NET_CAPABILITY_INTERNET` and `NET_CAPABILITY_VALIDATED`                             | not available                                            |
| `internet.captivePortal` | `NET_CAPABILITY_CAPTIVE_PORTAL`                                                      | not available                                            |
| `conditions.metered`     | not `NET_CAPABILITY_NOT_METERED` and not `TEMPORARILY_NOT_METERED` (API 30+)         | `NWPath.isExpensive`                                     |
| `conditions.constrained` | Metered and Data Saver restricts the app (`RESTRICT_BACKGROUND_STATUS_ENABLED`)      | `NWPath.isConstrained` (Low Data Mode)                   |
| `latency.httpsMs`        | OkHttp `callStart` to `responseHeadersEnd`                                           | `fetchStartDate` to `responseStartDate`                  |
| `latency.dnsMs`          | `dnsStart` to `dnsEnd`                                                               | `domainLookupStartDate` to `domainLookupEndDate`         |
| `latency.tcpConnectMs`   | `connectStart` to `secureConnectStart`                                               | `connectStartDate` to `secureConnectionStartDate`        |
| `latency.tlsHandshakeMs` | `secureConnectStart` to `secureConnectEnd`                                           | `secureConnectionStartDate` to `secureConnectionEndDate` |

## What is not measured

Bandwidth or throughput, packet loss, jitter, ICMP ping, signal strength, SSID, IP
addresses, cellular generation, other apps' traffic, and the content of any request or
response. See [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) for why.

## Network requests the package makes

Exactly one HTTPS request per sample (default one sample, at most five) to the URL passed
as `endpoint`, and only when `getNetworkDiagnostics` (or the hook) is called with an
endpoint while the OS reports a connection. Request details:

- Method `HEAD` (default) or `GET`; header `Cache-Control: no-cache`; platform default
  `User-Agent`.
- No cookies, no cached responses, no stored credentials, no request body.
- Redirects are not followed; the response body is not read.

No other request is ever made. Nothing is sent to the package authors or to any third
party, and there is no telemetry.

## File map

| Path                                                                          | Purpose                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/NativeNetworkDiagnostics.ts`                                             | Codegen spec (native contract)                   |
| `src/diagnostics.ts`                                                          | Public async API and listener                    |
| `src/hooks/useNetworkDiagnostics.ts`                                          | React hook                                       |
| `src/quality.ts`                                                              | Quality classification and thresholds            |
| `src/options.ts`                                                              | Option and endpoint validation                   |
| `src/normalize.ts`                                                            | Native payload normalization, sample aggregation |
| `src/errors.ts`                                                               | Error codes and `NetworkDiagnosticsError`        |
| `src/timeout.ts`                                                              | JS timeout guard                                 |
| `android/.../NetworkDiagnosticsModule.kt`                                     | TurboModule, monitoring                          |
| `android/.../NetworkInspector.kt`                                             | ConnectivityManager reads                        |
| `android/.../EndpointProber.kt`                                               | OkHttp probe with timings                        |
| `android/.../NetworkStateMapper.kt`, `ProbeErrorMapper.kt`, `ProbeTimings.kt` | Pure logic (JUnit tested)                        |
| `ios/NetworkDiagnostics.mm`                                                   | TurboModule adapter                              |
| `ios/NetworkDiagnosticsImpl.swift`                                            | NWPathMonitor, URLSession probe                  |
| `ios/Core/*.swift`                                                            | Pure logic (XCTest via `ios/Package.swift`)      |
| `scripts/check-codegen.js`                                                    | Verifies Codegen output for both platforms       |
