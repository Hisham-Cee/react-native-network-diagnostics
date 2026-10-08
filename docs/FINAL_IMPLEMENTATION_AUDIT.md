# Final implementation audit

| ---        | ---                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Package    | `react-native-network-diagnostics` 0.1.0 (unpublished)                                                |
| Repository | `Hisham-Cee/react-native-network-diagnostics`, branch `main`                                          |
| Audit date | 2026-10-07 (revision 2: 2026-10-08)                                                                   |
| Auditor    | Claude (AI assistant), at the maintainer's request                                                    |
| Verdict    | **Implementation complete for v0.1 scope. NOT release ready.** Score **72/100** (revision 1: 68/100). |

## Revision history

| Revision | Date       | Change                                                                                                                                                                                                                                                             |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | 2026-10-07 | Initial audit.                                                                                                                                                                                                                                                     |
| 2        | 2026-10-08 | Incorporated the maintainer's second Android validation round: Gradle Kotlin unit tests, Android release build, and physical-device scenarios A1, A2, A3, A4, A9, A10, A11 and monitoring. Confirmed the corrected `yarn.lock` is committed. iOS status unchanged. |

Android validation is substantially complete for the v0.1 scope. iOS remains the primary
release blocker because no iOS build or runtime validation has yet been performed.

## How this audit was performed (read first)

Two environments were involved. The difference matters for every PASS below.

1. **Maintainer's Windows PC** (`C:\react-native-network-diagnostics`). The auditor could
   read files there but could **not run commands** on it. Evidence from that machine comes
   from (a) build artifacts found on disk and (b) command output, screenshots and test
   results the maintainer reported. Revision 2 results (Gradle unit tests, release build,
   device scenarios) were run by the maintainer on that PC and phone.
2. **Auditor's Linux sandbox** (Ubuntu 24.04, Node 22.22.0, JDK 21, Kotlin 2.0.21). A copy
   of the repository was kept here. Before the audit, the 101 tracked text files on the
   Windows PC were copied over and compared line by line (ignoring CRLF). 99 could be
   compared: **98 identical, 1 different** (`example/src/App.tsx`; the sandbox copy was
   then reset to match the PC). The other 2 (Kotlin files under
   `example/android/.../java/networkdiagnostics/example/`) were too deeply nested to copy,
   so they were not compared; they are scaffold files nobody edited.

   The sandbox has **no Android SDK** (Google and Maven Central downloads are blocked by
   its network policy) and **no Xcode or Swift toolchain**. Gradle, CocoaPods, Xcode and
   `swift test` therefore never ran in the sandbox.

Every automated check marked PASS was run in the sandbox unless the evidence column says
otherwise.

---

## 1. Executive summary

The package does what its v0.1 scope says on Android, where it has now been validated on a
physical device across the main scenarios. It is a New Architecture
TurboModule (TypeScript Codegen spec, Kotlin on Android, Swift behind a thin Objective-C++
adapter on iOS, no C++). It reports OS network state and, when given an HTTPS endpoint,
probes it with real DNS/TCP/TLS/total timings and normalized error codes.

**Verified:**

- 156 Jest tests pass, with 99.6% statement coverage of `src/`.
- Typecheck, lint, format, library build and Codegen all pass.
- A consumer project type-checks against the packed tarball.
- Android Kotlin unit tests pass under Gradle on the maintainer's PC.
- The Android example app builds in debug and release configurations. (The release build
  ran with R8 shrinking disabled, the React Native template default.)
- On a physical Android phone: Wi-Fi (A1), cellular including `metered: true` (A2),
  airplane mode / offline with no probe sent (A3), endpoint timeout (A4/A10),
  `DNS_FAILURE` (A9), `TLS_FAILURE` (A11) and network monitoring all PASS.

**Not verified:**

- iOS code has never been compiled, and no Swift test has run.
- CI has never run.
- Android: captive portal (no real captive-portal network available), VPN, metered Wi-Fi,
  Data Saver, HTTP error status, slow network, network switch mid-probe, API 24/25, other
  device models, R8 shrinking, and leak profiling.

**The audit found and fixed four issues:**

1. A stale `yarn.lock`. It made `yarn install --immutable`, the command CI uses, fail.
2. Likely iOS compile errors in Swift code: a captured local variable mutated inside
   closures that are `@Sendable` in current SDKs.
3. False documentation claims about web support and Expo.
4. A missing `.gitignore` entry for `.kotlin/`.

**Biggest remaining risk:** iOS is untested. A cross-platform package should not be
published until it has at least compiled and run once on iOS.

---

## 2. Repository state

### Git history (Windows PC, from `.git/logs/HEAD`)

```
c4d3981  Initial commit                              (GitHub clone)
183066b  chore: scaffold TurboModule library ...      (imported from bundle)
4f0f588  feat: TypeScript API, TurboModule spec ...
af26038  feat(android): Kotlin TurboModule implementation
72700ab  feat(ios): Swift implementation behind an Objective-C++ TurboModule
6ee4b59  docs: README, architecture, API, ...
<local>  fix(example): readable labels in dark mode   (committed by maintainer on the PC)
<local>  chore: final audit fixes and report          (committed by maintainer on the PC)
```

Revision 2 check: the PC's git index (copied from `.git/index`) lists the same 121 files
with the same blob hashes as the auditor's copy of this commit, including the corrected
`yarn.lock`.

- `main` on the PC is 6 commits ahead of `origin/main`. Nothing has been pushed.
- The maintainer's own last commit is content-identical to sandbox commit `6de73ba`.

### Uncommitted state on the PC at revision 1 (inferred from file comparison; `git status` could not be run there)

| Item                                                                                                                            | State                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn.lock`                                                                                                                     | Revision 1: modified and uncommitted. Revision 2: committed in "chore: final audit fixes and report" (verified via the PC's git index). |
| `example/android/.kotlin/`                                                                                                      | Untracked Kotlin compiler cache. Now ignored by `.gitignore` (audit change).                                                            |
| Build outputs (`android/build`, `example/android/build`, `example/android/app/build`, `.gradle`, `.cxx`, `node_modules`, `lib`) | Present and git-ignored.                                                                                                                |

### Files changed by this audit (revision 1; committed by the maintainer in "chore: final audit fixes and report")

| File                                                            | Change                                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/FINAL_IMPLEMENTATION_AUDIT.md`                            | New (this report)                                                                       |
| `ios/NetworkDiagnosticsImpl.swift`                              | Replaced a mutated captured `var finished` with a lock-based `OnceFlag`                 |
| `ios/Core/ProbeTimings.swift`                                   | Added `OnceFlag` (pure, testable)                                                       |
| `ios/Tests/NetworkDiagnosticsCoreTests/ProbeTimingsTests.swift` | Added `OnceFlag` tests                                                                  |
| `yarn.lock`                                                     | Regenerated; now identical to the maintainer's local copy                               |
| `.gitignore`                                                    | Added `.kotlin/`                                                                        |
| `README.md`                                                     | Corrected status, Expo, web and RN-version statements                                   |
| `docs/API.md`                                                   | Corrected listener initial-event note; removed web from `DIAGNOSTIC_UNAVAILABLE` causes |
| `docs/MANUAL_TESTING.md`                                        | Recorded the A1 result and the monitoring smoke check                                   |

---

## 3. Architecture audit

| Item                   | Finding                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TurboModule spec       | `src/NativeNetworkDiagnostics.ts`, `interface Spec extends TurboModule`, default export `TurboModuleRegistry.get<Spec>('NetworkDiagnostics')` (nullable on purpose so imports never throw).                                                                    |
| Spec methods           | `getNetworkState(): Promise<NativeNetworkState>`, `probeEndpoint(url, method, timeoutMs): Promise<NativeProbeResult>`, `startMonitoring(): void`, `stopMonitoring(): void`, `readonly onNetworkStateChange: CodegenTypes.EventEmitter<NativeNetworkState>`.    |
| Codegen config         | `package.json` → `codegenConfig` = `{ name: "NetworkDiagnosticsSpec", type: "modules", jsSrcsDir: "src", android.javaPackageName: "com.networkdiagnostics", ios.modulesProvider: { NetworkDiagnostics: "NetworkDiagnostics" } }`.                              |
| Generated Android      | `NativeNetworkDiagnosticsSpec.java` (abstract class with `emitOnNetworkStateChange(ReadableMap)`). Verified by `yarn codegen:check`. The real Gradle build on the PC generated it into `com.networkdiagnostics` and compiled against it.                       |
| Generated iOS          | `NetworkDiagnosticsSpec.h`: protocol `NativeNetworkDiagnosticsSpec`, base class `NativeNetworkDiagnosticsSpecBase` with `emitOnNetworkStateChange:`, JSI class `NativeNetworkDiagnosticsSpecJSI`. Verified by `yarn codegen:check`; never compiled.            |
| Android registration   | `NetworkDiagnosticsPackage : BaseReactPackage`, `ReactModuleInfo(isTurboModule = true)`; autolinked. Confirmed working: the app ran and the module answered on device.                                                                                         |
| iOS registration       | `NetworkDiagnostics.mm`: `@interface NetworkDiagnostics : NativeNetworkDiagnosticsSpecBase <NativeNetworkDiagnosticsSpec>`, `+moduleName`, `getTurboModule:` returns `NativeNetworkDiagnosticsSpecJSI`. Also discoverable via `modulesProvider`. Not compiled. |
| JS entry               | `src/index.ts` → built to `lib/module/index.js` + `lib/typescript/src/index.d.ts`.                                                                                                                                                                             |
| Legacy bridge fallback | **None.** No `RCT_EXPORT_MODULE`, no hand-written `ReactContextBaseJavaModule`.                                                                                                                                                                                |
| C++                    | None.                                                                                                                                                                                                                                                          |
| Fabric                 | Not used and not relevant (no views).                                                                                                                                                                                                                          |
| Min React Native       | `>=0.80.0`: the `CodegenTypes.` qualified event-emitter syntax needs Codegen 0.80+. This was confirmed by inspecting Codegen 0.76, 0.78, 0.79, 0.80 and 0.81 packages. **Only 0.86.2 has actually been built.**                                                |

**Verdict:** correct modern architecture. The Android side has been proven end to end on a
device. The iOS side is complete in code but unproven.

---

## 4. API audit

All exports of `src/index.ts`. "Docs" = documented in `docs/API.md` and/or README. "Tests" = Jest unless stated.

| Export                                                                                                                                                                                                        | Kind      | Signature / purpose                                                                                                                                                               | Platforms    | Docs                                  | Tests          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------- | -------------- |
| `getNetworkDiagnostics`                                                                                                                                                                                       | function  | `(options?: NetworkDiagnosticsOptions) => Promise<NetworkDiagnostics>`. OS state + optional HTTPS probe + quality. Rejects only for `INVALID_OPTIONS` / `DIAGNOSTIC_UNAVAILABLE`. | Android, iOS | Yes                                   | Yes (16 cases) |
| `getNetworkState`                                                                                                                                                                                             | function  | `() => Promise<NetworkState>`. Passive OS state, no traffic.                                                                                                                      | Android, iOS | Yes                                   | Yes            |
| `addNetworkStateListener`                                                                                                                                                                                     | function  | `(listener) => () => void`. Ref-counted native monitoring, de-duplicated.                                                                                                         | Android, iOS | Yes                                   | Yes            |
| `NetworkStateListener`                                                                                                                                                                                        | type      | `(state: NetworkState) => void`                                                                                                                                                   | -            | Yes                                   | n/a            |
| `useNetworkDiagnostics`                                                                                                                                                                                       | hook      | `(options?: UseNetworkDiagnosticsOptions) => { diagnostics, loading, error, refresh }`                                                                                            | Android, iOS | Yes                                   | Yes (10 cases) |
| `UseNetworkDiagnosticsOptions`, `UseNetworkDiagnosticsResult`                                                                                                                                                 | types     | Hook options (`runOnMount`, `monitor`, `monitorDebounceMs` + diagnostic options) / result                                                                                         | -            | Yes                                   | n/a            |
| `classifyNetworkQuality`                                                                                                                                                                                      | function  | `(input: QualityInput, thresholds?) => NetworkQuality` (pure)                                                                                                                     | any          | Yes                                   | Yes            |
| `classifyLatency`                                                                                                                                                                                             | function  | `(ms, thresholds?) => 'excellent' \                                                                                                                                               | 'good' \     | 'fair' \                              | 'poor'`        | any | Yes | Yes |
| `DEFAULT_QUALITY_THRESHOLDS`                                                                                                                                                                                  | const     | frozen `{ excellentMs: 150, goodMs: 400, fairMs: 1000 }`                                                                                                                          | any          | Yes                                   | Yes            |
| `NetworkDiagnosticsError`                                                                                                                                                                                     | class     | `Error` with `code: NetworkDiagnosticErrorCode`                                                                                                                                   | any          | Yes                                   | Yes            |
| `isNetworkDiagnosticsError`, `isNetworkDiagnosticErrorCode`                                                                                                                                                   | functions | type guards                                                                                                                                                                       | any          | Partly (README table)                 | Yes            |
| `NETWORK_DIAGNOSTIC_ERROR_CODES`                                                                                                                                                                              | const     | the 8 codes                                                                                                                                                                       | any          | Yes                                   | Yes            |
| `NetworkDiagnosticErrorCode`                                                                                                                                                                                  | type      | union of the 8 codes                                                                                                                                                              | -            | Yes                                   | n/a            |
| `DEFAULT_TIMEOUT_MS`, `MIN_TIMEOUT_MS`, `MAX_TIMEOUT_MS`, `MAX_SAMPLES`                                                                                                                                       | consts    | 5000, 500, 60000, 5                                                                                                                                                               | any          | Values documented, constant names not | Indirectly     |
| `NetworkDiagnostics`, `NetworkState`, `EndpointResult`, `LatencyMetrics`, `DiagnosticError`, `NetworkDiagnosticsOptions`, `NetworkQuality`, `NetworkType`, `ProbeMethod`, `QualityInput`, `QualityThresholds` | types     | Public data model                                                                                                                                                                 | -            | Yes                                   | n/a            |

**Options** (`NetworkDiagnosticsOptions`): `endpoint` (https only, no default), `timeoutMs`
(5000, range 500 to 60000), `method` (`HEAD` | `GET`), `samples` (1 to 5, median, stops at
first failure), `qualityThresholds`.

**API observations:**

- Small, typed, no `any`. Optional platform fields are `undefined`, never invented.
- `DEFAULT_TIMEOUT_MS` and the other constants are exported but not named in the docs.
  This is minor.
- `refresh()` resolves `undefined` both on error and when superseded by a newer run.
  Callers can't tell these apart without reading `error`. This is acceptable for 0.x.
- No cancellation API. This is documented.

---

## 5. Platform capability matrix

| Capability                   | Android                                                                                         | iOS                                                                | Notes                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connected                    | **Supported**: active network exists and is not suspended (API 28+)                             | **Supported (code only)**: `NWPath.status == .satisfied`           | "Connected" means the OS has a route, not proof of internet.                                                                                                                         |
| Network type                 | **Supported**: ethernet > wifi > cellular > other > vpn                                         | **Supported (code only)**: via `usesInterfaceType`                 | iOS never reports `vpn`.                                                                                                                                                             |
| VPN flag                     | **Supported** (`TRANSPORT_VPN`)                                                                 | **Unavailable**: `undefined`                                       | Correctly documented.                                                                                                                                                                |
| Internet validated (OS)      | **Supported** (`NET_CAPABILITY_VALIDATED` + `INTERNET`)                                         | **Unavailable**: `undefined`                                       | Verified on device: true on Wi-Fi and cellular, false when offline.                                                                                                                  |
| Captive portal (OS)          | **Supported** (`NET_CAPABILITY_CAPTIVE_PORTAL`)                                                 | **Unavailable**: `undefined`                                       | NOT VERIFIED on a device: no real captive-portal network was available. Device runs showed `captivePortal: false` on normal Wi-Fi and cellular.                                      |
| Metered                      | **Supported** (not `NOT_METERED` and not `TEMPORARILY_NOT_METERED`)                             | **Supported (code only)** (`isExpensive`)                          | Verified on device: cellular `true`, Wi-Fi `false`. User-marked metered Wi-Fi not tested.                                                                                            |
| Constrained                  | **Partial**: Data Saver restricting this app, metered networks only; updates on next event/read | **Supported (code only)** (`isConstrained`, Low Data Mode)         | Different concepts, as documented. Device showed `false` on cellular with Data Saver off; Data Saver on not tested.                                                                  |
| Actual internet reachability | **Supported via probe** (developer endpoint)                                                    | **Supported via probe (code only)**                                | Without an endpoint only the OS signal exists (Android) or nothing (iOS). Android probe verified: 204 reachable, `TIMEOUT`, `DNS_FAILURE`, `TLS_FAILURE`, and no probe when offline. |
| HTTPS latency (`httpsMs`)    | **Supported**: OkHttp `callStart` to `responseHeadersEnd`                                       | **Supported (code only)**: `fetchStartDate` to `responseStartDate` | Verified on device: 352 and 386 ms (Wi-Fi), 388 ms (cellular).                                                                                                                       |
| DNS time                     | **Supported**: OkHttp `dnsStart`/`dnsEnd`                                                       | **Supported (code only)**: transaction metrics                     | Real resolver timing; may be cache-served.                                                                                                                                           |
| TCP / TLS time               | **Supported**                                                                                   | **Supported (code only)**                                          | Verified on device: TCP 50 to 79 ms, TLS 112 to 183 ms across runs.                                                                                                                  |
| Backend status code          | **Supported**                                                                                   | **Supported (code only)**                                          | Redirects not followed; body not read.                                                                                                                                               |
| Change monitoring            | **Supported** (`registerDefaultNetworkCallback`)                                                | **Supported (code only)** (`NWPathMonitor`)                        | Android PASS on a physical device across network changes.                                                                                                                            |
| Web                          | Not supported                                                                                   | Not supported                                                      | Importing fails on react-native-web (no `TurboModuleRegistry`). Docs corrected.                                                                                                      |

"(code only)" = implemented but never compiled or run.

The JS layer communicates these limits honestly. `normalizeNetworkState` keeps missing
booleans as `undefined`, and the iOS mapper's `toDictionary()` never emits `vpn`,
`validated` or `captivePortal`; this is covered by Swift tests that have not run.

---

## 6. Accuracy audit

### Internet connectivity

- **Without an endpoint**, the package does not verify internet access itself.
  - Android: it relays the OS's own validation (`NET_CAPABILITY_VALIDATED`), which is a
    real internet check performed by Android.
  - iOS: it only knows that a route exists.
  - `quality` is `unknown` in this case, unless offline or (on Android) not validated. This
    is documented and honest.
- **With an endpoint**, it performs a real HTTPS request. `reachable: true` means an HTTP
  response arrived, with any status code.

### HTTPS latency

| Aspect     | Implementation                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint   | Developer-supplied, `https://` only; validated in JS and again natively. No default.                                                          |
| Timeout    | 5000 ms default. Native: OkHttp `callTimeout` + connect/read/write; URLSession request + resource timeout. JS guard at `timeoutMs + 2000 ms`. |
| Method     | `HEAD` default, `GET` optional.                                                                                                               |
| Redirects  | Not followed (OkHttp `followRedirects(false)`; URLSession delegate returns `nil`).                                                            |
| Connection | Fresh every sample: OkHttp pool with 0 idle connections, evicted after use; ephemeral `URLSession` per probe.                                 |
| Included   | DNS + TCP + TLS + request + server time to first response header.                                                                             |
| Body       | Never downloaded.                                                                                                                             |

Device evidence (phase times always below the total; the rest is request and server time):

| Run               | DNS | TCP | TLS | Sum of phases | `httpsMs` |
| ----------------- | --- | --- | --- | ------------- | --------- |
| Wi-Fi, round 1    | 8   | 72  | 183 | 263           | 352       |
| Wi-Fi, round 2    | 58  | 50  | 112 | 220           | 386       |
| Cellular, round 2 | 12  | 79  | 123 | 214           | 388       |

Caveats (all now documented in `docs/API.md` and the README, revision 2):

- The metric includes server processing time, so a slow server looks like a slow network.
- One sample is noisy; `samples` (median) is available.
- On Android, OkHttp fires `callStart` at `enqueue()`, so
  dispatcher queue time is included. This is negligible except under heavy concurrent use
  of the same prober.
- The probe uses its own `OkHttpClient` and `URLSession`, not the
  app's networking stack. App interceptors, certificate pinning and custom proxies are not
  exercised. The Android network security config still applies.

### DNS latency

These are genuine resolver timings for the probe's hostname lookup (OkHttp DNS events on
the system resolver; `domainLookup*` dates on iOS). Both may be answered from the OS cache,
so near-zero values are possible. This is documented. It is **not** an independent DNS
benchmark, and the docs don't claim it is.

### Speed / bandwidth

Not implemented, deliberately. The package makes no throughput claims.

### Quality classification (`src/quality.ts`)

Rules, first match wins:

1. `connected === false` → `offline`
2. `captivePortal === true` → `offline`
3. Probe made and no response → `poor`
4. Probe succeeded → latency buckets on `httpsMs`: `< 150` excellent, `< 400` good,
   `< 1000` fair, else poor
5. No probe and `validated === false` → `poor`
6. Otherwise → `unknown`

The rationale is documented: a fresh HTTPS request is about three round trips, and
Nielsen's 1 s limit. The thresholds are explicitly called heuristics and are overridable.
HTTP status codes are ignored on purpose.

**Accuracy risk (minor, documented in revision 2):** right after a network switch, Android may
briefly report `validated: false` while it validates. Without an endpoint, a monitored
hook can then show `poor` for a moment.

---

## 7. Privacy and security audit

| Check                                                           | Result                                                                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Telemetry / analytics SDKs                                      | None. No runtime dependencies at all (`dependencies: {}`). Android adds only `okhttp:4.9.2`, which React Native already ships.               |
| Automatic network requests                                      | None. Requests happen only when the app passes `endpoint`.                                                                                   |
| Data sent to the author or third parties                        | None.                                                                                                                                        |
| URLs in library source (`src`, `android/src/main`, `ios`)       | None, apart from the Android XML namespace.                                                                                                  |
| URLs in example app                                             | `https://clients3.google.com/generate_204`, used only when the user taps "Use sample endpoint"; labelled in code and docs.                   |
| Secrets / API keys / tokens                                     | None found (searched for api key, secret, token, password, bearer, analytics, telemetry, firebase, sentry, mixpanel, amplitude, segment).    |
| `storePassword 'android'` in `example/android/app/build.gradle` | Standard React Native public debug keystore; not a secret.                                                                                   |
| Permissions                                                     | Android `ACCESS_NETWORK_STATE`, `INTERNET` (normal, install-time); confirmed in the manifest merge report. iOS none. No location permission. |
| Sensitive network info                                          | No SSID, BSSID, IP or carrier data is read. Error messages contain exception text only, capped at 300 characters; never headers or bodies.   |
| Probe hygiene                                                   | No cookies, cache, stored credentials or request body; credentials in URLs rejected.                                                         |

**Result:** nothing suspicious found.

---

## 8. Error handling audit

### Error model

`NetworkDiagnosticErrorCode` = `TIMEOUT | DNS_FAILURE | CONNECTION_FAILURE | TLS_FAILURE | INVALID_ENDPOINT | INVALID_OPTIONS | DIAGNOSTIC_UNAVAILABLE | UNKNOWN`.

- Network failures resolve as data in `endpoint.error`.
- Promise rejections (`NetworkDiagnosticsError`) happen only for `INVALID_OPTIONS`,
  `DIAGNOSTIC_UNAVAILABLE`, and a state-read `TIMEOUT`.

| Path                            | Android                                                                                     | iOS                                                                                                                                                                   | JS                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Timeout                         | `SocketTimeoutException`, `InterruptedIOException` → `TIMEOUT`                              | `URLError.timedOut` → `TIMEOUT`                                                                                                                                       | Guard at `timeoutMs + 2000` returns `TIMEOUT` sample                 |
| DNS failure                     | `UnknownHostException`                                                                      | `.cannotFindHost`, `.dnsLookupFailed`                                                                                                                                 | Normalized                                                           |
| TLS failure                     | `SSLException`, `CertificateException`                                                      | `.secureConnectionFailed`, `.serverCertificate*`, `.clientCertificate*`                                                                                               | Normalized                                                           |
| Connection failure              | `ConnectException`, `NoRouteToHostException`, `PortUnreachableException`, `SocketException` | `.cannotConnectToHost`, `.networkConnectionLost`, `.notConnectedToInternet`, `.internationalRoamingOff`, `.callIsActive`, `.dataNotAllowed`, `.cannotLoadFromNetwork` | Not sent when OS says offline (`CONNECTION_FAILURE` without request) |
| Invalid endpoint                | JS check + `toHttpUrlOrNull` / https check                                                  | JS check + `URLComponents` validation; `.badURL`, `.unsupportedURL`, ATS                                                                                              | JS check, no request                                                 |
| Unknown native error            | `UNKNOWN` (cause chain walked, depth 8, cycle-safe)                                         | `UNKNOWN`                                                                                                                                                             | Unknown strings → `UNKNOWN`                                          |
| Native module missing           | n/a                                                                                         | n/a                                                                                                                                                                   | `DIAGNOSTIC_UNAVAILABLE` at call time; import does not throw         |
| Native exceptions               | `getNetworkState` rejects with codes; `probeEndpoint` never rejects                         | `getNetworkState` rejects on 2 s timeout; probe never rejects                                                                                                         | Unexpected rejections become `UNKNOWN` samples                       |
| Monitoring registration failure | Caught and logged (`Log.w`); monitoring silently absent                                     | n/a                                                                                                                                                                   | n/a                                                                  |
| Cancellation                    | Not supported                                                                               | Not supported                                                                                                                                                         | Results after unmount are discarded                                  |
| Cleanup                         | `invalidate()` unregisters callback                                                         | `invalidate` stops `NWPathMonitor`                                                                                                                                    | Listener ref-count, idempotent unsubscribe                           |

Android and iOS errors are normalized consistently. The Android mapping is unit-tested
(Gradle PASS in revision 2) and was observed on a physical device for `DNS_FAILURE`,
`TLS_FAILURE`, `TIMEOUT` and the offline `CONNECTION_FAILURE` path (which the JS layer
produces without sending a request). Native `ConnectException`-style connection failures
are covered by unit tests only. The iOS mapping has tests that have never run.

**Gaps:**

- Monitoring registration failure on Android is only logged, never surfaced to JS.
- Android `callTimeout` cannot interrupt a blocking DNS lookup. The JS guard covers this,
  but the native thread stays busy until the resolver gives up.

---

## 9. Hook audit (`src/hooks/useNetworkDiagnostics.ts`)

| Aspect            | Finding                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial state     | `diagnostics: undefined`, `loading: runOnMount` (default true), `error: undefined`.                                                                                   |
| Refresh           | `refresh()` increments a run id; only the latest run updates state. Tested ("only the latest of overlapping refreshes is applied").                                   |
| Unmount           | `mountedRef` guards all state updates after unmount. Tested; no React warning emitted.                                                                                |
| Monitoring        | Opt-in. Passive listener; on a changed state key, debounced (1000 ms) `refresh()`. The initial event matching the current result is skipped. Tested with fake timers. |
| Cleanup           | Effect cleanup clears the debounce timer and unsubscribes; native `stopMonitoring` runs when the last listener goes. Tested.                                          |
| Dependency arrays | Options compared by value (`thresholdsKey`), so inline objects don't re-run. Tested.                                                                                  |
| Re-renders        | `setLoading(true)` repeated calls are no-ops in React. No render loops found.                                                                                         |
| Types             | Strict, no `any`.                                                                                                                                                     |

**Issues (all minor):**

- Changing any diagnostic option while `monitor` is on re-creates `refresh`. This
  resubscribes the listener and causes a native stop/start cycle. It is correct but
  wasteful.
- If a monitored refresh fails, `lastStateKeyRef` already holds the new state, so the same
  state won't trigger a retry until the network changes again.
- `error` remains set from a previous failure until the next successful run, by design.
  `diagnostics` keeps the last good value at the same time, which may surprise users.

---

## 10. Testing results

| Check                                      | Command                                                                                | Where                                              | Result                            | Evidence                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lockfile immutability (CI install)         | `yarn install --immutable`                                                             | Sandbox                                            | **FAIL before fix → PASS after**  | `YN0028: The lockfile would have been modified`. Fixed by regenerating `yarn.lock`, which now matches the PC copy byte for byte.                                                                                                                                                             |
| TypeScript                                 | `yarn typecheck`                                                                       | Sandbox                                            | **PASS**                          | exit 0                                                                                                                                                                                                                                                                                       |
| ESLint                                     | `yarn lint`                                                                            | Sandbox                                            | **PASS**                          | exit 0, no output                                                                                                                                                                                                                                                                            |
| Prettier                                   | `yarn format`                                                                          | Sandbox                                            | **PASS**                          | "All matched files use Prettier code style!"                                                                                                                                                                                                                                                 |
| Unit tests                                 | `yarn test:coverage --ci`                                                              | Sandbox                                            | **PASS**                          | 8 suites, 156 tests; statements 99.64%, branches 97%, functions 100%                                                                                                                                                                                                                         |
| Unit tests                                 | `yarn test`                                                                            | Windows PC (run by maintainer)                     | **PASS**                          | Pasted output: 8 suites, 156 tests                                                                                                                                                                                                                                                           |
| Library build                              | `yarn prepare` (bob)                                                                   | Sandbox                                            | **PASS**                          | `lib/module` + `lib/typescript` written                                                                                                                                                                                                                                                      |
| Codegen                                    | `yarn codegen:check`                                                                   | Sandbox                                            | **PASS**                          | Android `NativeNetworkDiagnosticsSpec.java` OK, iOS `NetworkDiagnosticsSpec.h` OK                                                                                                                                                                                                            |
| Consumer typing                            | `tsc` on a temp app importing the packed tarball                                       | Sandbox                                            | **PASS**                          | `CONSUMER_TYPES_OK`                                                                                                                                                                                                                                                                          |
| npm package                                | `npm pack --dry-run` and real `npm pack` + extract                                     | Sandbox                                            | **PASS**                          | 72 files, 53.1 kB packed, 189.3 kB unpacked                                                                                                                                                                                                                                                  |
| Kotlin unit tests (pure logic)             | `kotlinc` 2.0.21 + local JUnit stand-in harness                                        | Sandbox                                            | **PASS (non-standard runner)**    | 27/27 passed. Not run with real JUnit/Gradle. Superseded by the Gradle PASS in revision 2 (next row).                                                                                                                                                                                        |
| Kotlin unit tests (Gradle)                 | `.\gradlew :react-native-network-diagnostics:testDebugUnitTest` (in `example/android`) | Windows PC, JDK 17 (run by maintainer, revision 2) | **PASS**                          | `BUILD SUCCESSFUL`, 29 actionable tasks (5 executed, 24 up-to-date). Warnings only: invalid Java 11 entry in the Windows registry (not used) and Gradle 10 deprecation notice.                                                                                                               |
| Android library + app build                | `yarn example android` (Gradle `app:installDebug`)                                     | Windows PC (run by maintainer)                     | **PASS**                          | Library `.class` files for all 8 Kotlin sources and `app-debug.apk` (118.7 MB, 2026-10-07 14:12 IST) found on disk; Gradle problems report: 13 deprecation warnings, 0 errors                                                                                                                |
| Android on device, A1 Wi-Fi                | Example app, sample endpoint                                                           | Maintainer's phone                                 | **PASS**                          | Round 1 screenshot: HTTP 204, 352/8/72/183 ms, GOOD. Round 2: HTTP 204, 386/58/50/112 ms, GOOD                                                                                                                                                                                               |
| Android on device, A2 cellular             | Example app, sample endpoint                                                           | Maintainer's phone (revision 2)                    | **PASS**                          | Cellular, validated, metered yes, constrained no, HTTP 204, 388/12/79/123 ms, GOOD                                                                                                                                                                                                           |
| Android on device, A3 airplane mode        | Example app                                                                            | Maintainer's phone (revision 2)                    | **PASS**                          | Disconnected, type none, `CONNECTION_FAILURE`, timings not measured (no probe), OFFLINE                                                                                                                                                                                                      |
| Android on device, A4/A10 endpoint timeout | Example app                                                                            | Maintainer's phone (revision 2)                    | **PASS**                          | Wi-Fi connected, validated no in this capture, `TIMEOUT`, POOR. Black-hole setup and timing not recorded                                                                                                                                                                                     |
| Android on device, A9 DNS failure          | `https://clients3.google.invalid`                                                      | Maintainer's phone (revision 2)                    | **PASS**                          | Wi-Fi validated yes (device online), `DNS_FAILURE`, POOR                                                                                                                                                                                                                                     |
| Android on device, A11 TLS failure         | Invalid-certificate endpoint                                                           | Maintainer's phone (revision 2)                    | **PASS**                          | `TLS_FAILURE` shown; other values not recorded                                                                                                                                                                                                                                               |
| Android on device, A5 captive portal       | -                                                                                      | -                                                  | **NOT RUN**                       | No real captive-portal network available                                                                                                                                                                                                                                                     |
| Android monitoring                         | Example app, monitor on, network changes                                               | Maintainer's phone                                 | **PASS**                          | Confirmed by the maintainer as tested successfully across network changes (revision 2)                                                                                                                                                                                                       |
| Android release build                      | `.\gradlew :app:assembleRelease` (in `example/android`)                                | Windows PC, JDK 17 (run by maintainer, revision 2) | **PASS**                          | `BUILD SUCCESSFUL`, 112 actionable tasks (97 executed, 15 up-to-date); `app-release.apk` (52.5 MB, 2026-10-07 16:04 IST) on disk. R8 shrinking **not exercised**: `enableProguardInReleaseBuilds = false` in the example, and no R8 mapping output exists. Release APK runtime not recorded. |
| iOS pod install / build                    | `pod install`, `yarn example ios`                                                      | -                                                  | **NOT RUN: requires macOS/Xcode** |                                                                                                                                                                                                                                                                                              |
| Swift unit tests                           | `cd ios && swift test`                                                                 | -                                                  | **NOT RUN: requires macOS/Xcode** |                                                                                                                                                                                                                                                                                              |
| CI workflow                                | `.github/workflows/ci.yml`                                                             | -                                                  | **NOT RUN**                       | Awaiting first run. It triggers only on push or pull request to `main` (or a manual run once it is on `main`), so a push to another branch alone does not run it. The lockfile cause of a certain failure is fixed and committed.                                                            |

---

## 11. Test coverage assessment

**Well covered (meaningful behavior, not existence checks):**

- **Quality classification:** every rule and every bucket boundary (149/150, 399/400,
  999/1000), plus invalid input.
- **Option validation and endpoint validation:** 24 accepted and rejected URLs with the
  specific reason checked.
- **Error normalization:** every code, unknown codes, native rejections.
- **Native-to-JS normalization:** garbage payloads, iOS-style missing fields,
  inconsistent connected/type, invalid numbers.
- **Diagnostics flow:** no endpoint means no request; offline means no request; success;
  median of samples; stop on first failure; every error code; HTTP 503; malformed
  endpoint; JS timeout guard; custom thresholds; captive portal.
- **Hook lifecycle:** mount, loading, no polling, value-compared options, errors,
  debounced monitoring, cleanup, stale results, overlapping refreshes.
- **Missing native module.**
- **Kotlin pure logic:** capability mapping, VPN/transport priority, API-level nulls,
  error cause-chain walking including cycles, timing math.

**Revision 2:** the Kotlin unit tests now also pass under real JUnit/Gradle, and the main
Android scenarios have been exercised manually on a device (see `docs/MANUAL_TESTING.md`).

**Important missing tests:**

1. Any test of the Android `NetworkDiagnosticsModule`, `EndpointProber` or
   `NetworkInspector` against real Android/OkHttp classes (for example Robolectric plus
   MockWebServer: redirect not followed, body not read, timeout codes).
2. Any executed iOS test, including `NetworkDiagnosticsImpl` and `ProbeDelegate`.
3. End-to-end tests on a device or emulator (Detox or Maestro) for the example app.
4. Hook: option change while monitoring; retry after a failed monitored refresh.
5. Multiple simultaneous `addNetworkStateListener` subscribers receiving the same event
   (only ref-counting is tested).

---

## 12. Android audit

| Area                 | Finding                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language / structure | Kotlin. 8 source files. Android types are confined to `NetworkInspector`, `NetworkDiagnosticsModule` and `EndpointProber`; logic sits in pure files.                                                                                                                                                                                |
| Registration         | `BaseReactPackage` + `ReactModuleInfo(isTurboModule = true)`. Works on device in debug builds.                                                                                                                                                                                                                                      |
| Threading            | `getNetworkState`: quick binder call on the native-modules thread. Probe: OkHttp async dispatcher. Callbacks: ConnectivityManager thread. Nothing on the UI thread.                                                                                                                                                                 |
| Concurrency safety   | `monitorLock` guards callback, `lastEmitted` and registration. `ProbeTimings` fields `@Volatile`. `AtomicBoolean` ensures a single resolve.                                                                                                                                                                                         |
| Lifecycle            | `invalidate()` calls `stopMonitoring()`. Unregister is guarded against `IllegalArgumentException`.                                                                                                                                                                                                                                  |
| Cancellation         | None; bounded by timeouts.                                                                                                                                                                                                                                                                                                          |
| APIs                 | `ConnectivityManager.activeNetwork` (23+), `getNetworkCapabilities`, `registerDefaultNetworkCallback` (24+), `restrictBackgroundStatus` (24+). API-level guards for `WIFI_AWARE` (26), `LOWPAN` (27), `NOT_SUSPENDED` (28), `TEMPORARILY_NOT_METERED` (30), `USB` (31). No deprecated `NetworkInfo` / `getActiveNetworkInfo` usage. |
| Permissions          | `ACCESS_NETWORK_STATE`, `INTERNET` only.                                                                                                                                                                                                                                                                                            |
| SDK levels           | minSdk 24, compileSdk 36 (scaffold defaults; the app's values win via `rootProject.ext`).                                                                                                                                                                                                                                           |
| Gradle               | AGP 8.7.2 classpath in library buildscript, Kotlin 2.0.21. Built under the example's Gradle 9.3.1 / AGP 8.12.0, JDK 17. Debug build, release build and `testDebugUnitTest` all PASS on Windows.                                                                                                                                     |
| Gradle deprecation   | `android/build.gradle:39` uses `propName value` syntax (deprecated, fails in Gradle 10). Same pattern in the scaffold's example app. Low priority.                                                                                                                                                                                  |
| ProGuard/R8          | No consumer rules shipped. No reflection on library classes (package instantiates the module directly), so none should be needed. Release build PASS (revision 2), but with `minifyEnabled` off, so **R8 shrinking/obfuscation is not verified**.                                                                                   |
| Dependency           | `com.squareup.okhttp3:okhttp:4.9.2`. React Native exposes the same version as `api`; Gradle resolves to the app's version if newer.                                                                                                                                                                                                 |
| Swallowed exceptions | Two `Log.w` catches (callback registration, emit). Intentional, but registration failure is invisible to JS.                                                                                                                                                                                                                        |
| New Architecture     | Correct.                                                                                                                                                                                                                                                                                                                            |

---

## 13. iOS audit

### Code inspection completed

| Area                    | Finding                                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure               | `NetworkDiagnostics.h/.mm` (Objective-C++ adapter, 86 lines) → `NetworkDiagnosticsImpl.swift` (`@objc` NSObject). Pure logic in `ios/Core/*.swift`.                                                                                                                                                            |
| Registration            | Conforms to the generated protocol; inherits `NativeNetworkDiagnosticsSpecBase` for events; `modulesProvider` set; `getTurboModule:` returns the generated JSI class.                                                                                                                                          |
| Swift header import     | `#if __has_include("NetworkDiagnostics/NetworkDiagnostics-Swift.h")` fallback pattern; podspec sets `DEFINES_MODULE = YES`.                                                                                                                                                                                    |
| Networking              | Ephemeral `URLSession` per probe (no cache, cookies or credential storage), `waitsForConnectivity = false`, redirect delegate returns `nil`, `.cancel` after headers, `URLSessionTaskMetrics` for phases, `finishTasksAndInvalidate()` to break the session-to-delegate retain.                                |
| Timeouts                | `timeoutIntervalForRequest` and `timeoutIntervalForResource` = timeout (clamped 0.5 to 60 s).                                                                                                                                                                                                                  |
| Concurrency             | Private serial queues; single-resolve guarded by `NSLock`. **Fixed in this audit:** `getNetworkState` mutated a captured local `var` inside Network and Dispatch closures. These are `@Sendable` in current SDKs, which very likely would not compile. Replaced with `OnceFlag` (lock-based class) plus tests. |
| Lifecycle               | `invalidate` → `stopMonitoring`; monitor handlers nil-ed on cancel to avoid retain cycles.                                                                                                                                                                                                                     |
| Low Data Mode           | `NWPath.isConstrained` mapped to `constrained`.                                                                                                                                                                                                                                                                |
| Permissions             | None. Local Network prompt only if the endpoint is on the LAN (documented).                                                                                                                                                                                                                                    |
| Deployment target       | `min_ios_version_supported` (15.1 for RN 0.80+); `swift_version = 5.9`; `frameworks = Network`.                                                                                                                                                                                                                |
| Podspec                 | Source files limited to `ios/*.{h,mm,swift}` and `ios/Core/**/*.swift`; `ios/Package.swift` and `ios/Tests` excluded.                                                                                                                                                                                          |
| Remaining compile risks | Swift 5 mode may still warn about non-Sendable captures (`self` in `queue.async`). These are warnings, not errors. The `-Swift.h` import path has never been exercised. Untested with `use_frameworks!`.                                                                                                       |

### iOS build/test actually executed

**None.** Nothing on iOS has been compiled, linked, installed, run or unit-tested. All iOS
rows in this report are code inspection only.

---

## 14. Dependency audit

**Runtime `dependencies`:** none.

**Peer dependencies:** `react: *` and `react-native: >=0.80.0`. The lower bound is
justified by Codegen syntax but **untested below 0.86.2**.

**Native dependencies:** Android `okhttp:4.9.2` (already in React Native); iOS
`Network.framework` and React Native pods via `install_modules_dependencies`.

**devDependencies** (all development-only; none ship to consumers):

| Package                                                                                                                                        | Version | Why                     | Notes                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `react-native`                                                                                                                                 | 0.86.2  | Types, Codegen, example | Pinned to example version                                                            |
| `react`                                                                                                                                        | 19.2.3  | Peer for tests          |                                                                                      |
| `@react-native/babel-preset`                                                                                                                   | 0.86.2  | Babel for Jest/bob      |                                                                                      |
| `@react-native/eslint-config`                                                                                                                  | 0.86.2  | Lint rules              | Peer-warns: expects ESLint 8, repo uses 9 (works via `@eslint/compat`)               |
| `@react-native/jest-preset`                                                                                                                    | 0.86.2  | Jest preset             |                                                                                      |
| `eslint` 9.39, `@eslint/compat`, `@eslint/eslintrc`, `@eslint/js`, `eslint-config-prettier`, `eslint-plugin-prettier`, `eslint-plugin-ft-flow` | various | Linting                 | `ft-flow` required by RN config; none deprecated (checked `npm view ... deprecated`) |
| `prettier`                                                                                                                                     | ^3.9.6  | Formatting              |                                                                                      |
| `typescript`                                                                                                                                   | ^6.0.3  | Types                   | TS 6 defaults `types` to `[]`; `tsconfig` sets `types: ["jest"]`                     |
| `jest` ^30.5.2, `@types/jest` ^30                                                                                                              |         | Tests                   |                                                                                      |
| `@testing-library/react-native` ^14.0.1, `test-renderer` ^1.0.0                                                                                |         | Hook tests              |                                                                                      |
| `react-native-builder-bob`                                                                                                                     | ^0.43.1 | Builds `lib/`           |                                                                                      |
| `del-cli`                                                                                                                                      | ^7.0.0  | `clean` script          |                                                                                      |
| `turbo`                                                                                                                                        | ^2.10.8 | CI build caching        | Heavy, but only used in CI                                                           |
| `@types/react`                                                                                                                                 | ^19.2.0 | Types                   |                                                                                      |

No unnecessary runtime weight. The tooling is the standard `create-react-native-library`
set.

---

## 15. npm / package audit

| Field                        | Value                                                                                                                 | OK         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| name                         | `react-native-network-diagnostics` (unclaimed on npm as of 2026-10-07)                                                | Yes        |
| version                      | `0.1.0`                                                                                                               | Yes        |
| description, keywords        | Accurate, 11 relevant keywords                                                                                        | Yes        |
| repository / bugs / homepage | GitHub `Hisham-Cee/react-native-network-diagnostics`                                                                  | Yes        |
| license                      | MIT (file present)                                                                                                    | Yes        |
| author                       | `Hisham Mohammed <hishamcee@gmail.com>`                                                                               | Yes        |
| main / types / exports       | `lib/module/index.js`, `lib/typescript/src/index.d.ts`; `exports` with source condition; all targets exist in tarball | Yes        |
| `react-native` field         | Absent; `main`/`exports` suffice for current Metro                                                                    | Acceptable |
| codegenConfig                | Present; `jsSrcsDir: src` and `src` shipped                                                                           | Yes        |
| files                        | Allow-list; `react-native.config.js` listed but doesn't exist (harmless)                                              | Minor      |
| publishConfig                | `registry.npmjs.org`                                                                                                  | Yes        |

**Tarball (real `npm pack`, extracted):** 72 files.

- Shipped: `lib/module` JS, `lib/typescript` declarations, `src`, the 8 Kotlin sources,
  `AndroidManifest.xml`, `android/build.gradle`, 6 iOS sources (`.h`, `.mm`, Swift and
  Core Swift), podspec, README, LICENSE, CHANGELOG and `package.json`.
- Excluded, as intended: tests (`__tests__`, `android/src/test`, `ios/Tests`,
  `ios/Package.swift`), example, `.git`, build outputs, `node_modules`, coverage and
  dotfiles.

---

## 16. Documentation audit

**Discrepancies found and fixed in revision 1:**

| Doc                                  | Claim                                             | Reality                                                                         | Action                                                         |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| README Requirements                  | Web: "calls reject with `DIAGNOSTIC_UNAVAILABLE`" | react-native-web has no `TurboModuleRegistry`; import fails                     | Corrected                                                      |
| README Installation                  | "Expo: works in a development build"              | Never tested                                                                    | Reworded to "requires a development build ... not been tested" |
| README Requirements                  | RN 0.80 minimum                                   | Only 0.86.2 built                                                               | Added "Only 0.86.2 has been tested"                            |
| README status banner and Limitations | "not yet verified on physical devices"            | Android verified for one scenario                                               | Updated to the true state, iOS flagged                         |
| API.md listener                      | "Android reports it on registration"              | iOS `NWPathMonitor` also reports the initial path; later listeners don't get it | Corrected                                                      |
| API.md error table                   | Web listed as a `DIAGNOSTIC_UNAVAILABLE` cause    | Web fails at import                                                             | Removed                                                        |
| MANUAL_TESTING                       | "None of the scenarios have been executed"        | A1 and the monitoring check have been                                           | Recorded                                                       |

**Revision 2 documentation updates:**

| Doc                      | Change                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/MANUAL_TESTING.md` | Status summary, PASS / NOT RUN for every Android and iOS row, observed error codes, Gradle and release-build results. Captive portal recorded as NOT RUN with the reason. |
| `README.md`              | Status banner, Limitations and Testing reflect the Android validation; iOS and captive portal stated as unverified; accuracy caveats added.                               |
| `docs/API.md`            | Exported constants named; the three accuracy caveats documented.                                                                                                          |
| `docs/CONTRIBUTING.md`   | No longer claims CI runs; says it is configured but has not run yet.                                                                                                      |

**Remaining documentation issues:** none known that contradict verified behavior. The
README and docs still describe iOS behavior from code inspection only; this is stated
wherever iOS appears.

Otherwise the README covers description, rationale, install, requirements, New
Architecture, usage, API, hook, configuration, platform support, limitations, privacy,
troubleshooting, testing, contributing and license. These sections match the code.

---

## 17. Competitive positioning

1. **What it does that NetInfo does not:**
   - Per-phase DNS/TCP/TLS/total timing of a request to the app's own backend, on both
     platforms.
   - Normalized failure causes (DNS vs TLS vs timeout vs no route).
   - Android captive-portal and Data Saver signals.
   - iOS Low Data Mode.
   - A documented quality bucket.
2. **Problem solved:** "Requests are failing or slow; is it the network, DNS, TLS, a
   captive portal, or our server?" `fetch` only says "Network request failed".
3. **Genuinely useful?** Yes, for support screens, in-app diagnostics, deciding when to
   defer heavy work, and bug reports. It is a niche tool, not a must-have for every app.
4. **Overlap with NetInfo:** deliberately small (`connected`, `type`). Acceptable,
   because the diagnosis needs that context.
5. **Clear reason to install?** Only if the app needs to explain or log network failures.
   The README positions it this way and does not pitch it as a NetInfo replacement.
6. **Existing alternatives:**
   - NetInfo and expo-network cover connection state.
   - `react-native-network-quality` claims latency, throughput and loss, but its 1.0.1
     tarball has no Android code.
   - No maintained package found offers phase timings with normalized errors.
7. **Strongest differentiator:** phase-timed, error-normalized HTTPS diagnostics against
   the developer's own endpoint, local-first, with no default third-party traffic.

**Weaknesses:**

- iOS lacks OS validation and captive-portal signals, so iOS value depends entirely on the
  probe.
- Quality is a latency-only heuristic.
- Without an endpoint, the package adds little over NetInfo. This is the honest weak spot
  of the "no default endpoint" privacy decision.

---

## 18. Code quality

| Search                                                                                             | Result                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TODO`, `FIXME`, `XXX`, `debugger`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `fatalError` | None in `src`, `android/src`, `ios`, `example/src`, `scripts`                                                                                                                                               |
| `console.*`                                                                                        | Only in `scripts/check-codegen.js` (CLI output, intended)                                                                                                                                                   |
| `any`                                                                                              | None (the only match is the word "any" in a comment)                                                                                                                                                        |
| Swift force unwraps (non-test)                                                                     | None                                                                                                                                                                                                        |
| Type assertions in `src`                                                                           | 3 (`as NetworkType` after a membership check, `as Record<string, unknown>` after an object check, `Object.keys(...) as Array<keyof T>`); all guarded                                                        |
| Swallowed exceptions                                                                               | Android `Log.w` in two places (see Android audit)                                                                                                                                                           |
| Debug code                                                                                         | None in the library. The example's debug event counter was not kept on the PC.                                                                                                                              |
| Magic numbers                                                                                      | Named constants (`DEFAULT_TIMEOUT_MS`, `JS_TIMEOUT_GRACE_MS`, `STATE_TIMEOUT_MS`, thresholds, `MAX_CAUSE_DEPTH`). Timeout clamps (500/60000) are duplicated across JS, Kotlin and Swift; keep them in sync. |
| Dead code                                                                                          | `isNetworkDiagnosticErrorCode` is used internally and exported; nothing unused found.                                                                                                                       |
| Size                                                                                               | About 2,600 lines across TS, Kotlin, Swift and ObjC++ sources (excluding tests and docs)                                                                                                                    |

---

## 19. Git hygiene

| Check                                  | Result                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets / credentials in tracked files | None                                                                                                                                                    |
| IDE / local config tracked             | None (`.vscode`, `.idea`, `local.properties` ignored)                                                                                                   |
| Build artifacts tracked                | None (`lib/`, `build/`, `.gradle`, `.cxx`, `coverage/`, `node_modules` ignored)                                                                         |
| `.kotlin/`                             | Ignored since the audit commit                                                                                                                          |
| `yarn.lock`                            | Corrected copy committed on the PC in "chore: final audit fixes and report" (revision 2, verified via `.git/index`)                                     |
| Commit authorship                      | All commits by `Hisham Mohammed <hishamcee@gmail.com>`, unsigned. GitHub will show them as unverified unless signed before pushing. Informational only. |
| Pushed / published                     | Nothing pushed, nothing published                                                                                                                       |

---

## 20. Release readiness score

| Area                        | Score | Reason                                                                                                                                                                                                                                                                                  |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture                | 85    | Correct TurboModule/Codegen design, no legacy path, proven on Android                                                                                                                                                                                                                   |
| API design                  | 82    | Small, typed, honest `undefined`s; no cancellation; constants under-documented                                                                                                                                                                                                          |
| Native implementation       | 76    | Android verified across the main device scenarios; iOS complete but never compiled (one probable compile error fixed blind). Revision 1: 70                                                                                                                                             |
| Android readiness           | 86    | Gradle unit tests, debug and release builds PASS; A1, A2, A3, A4, A9, A10, A11 and monitoring PASS on a device. Not verified: captive portal, VPN, metered Wi-Fi, Data Saver, HTTP error, slow network, mid-probe switch, API 24/25, other devices, R8 shrinking, leaks. Revision 1: 72 |
| iOS readiness               | 30    | Zero builds, zero runs, zero executed tests                                                                                                                                                                                                                                             |
| Testing                     | 72    | Strong JS tests; Kotlin tests pass in Gradle; broad Android manual coverage; no iOS tests executed; no E2E. Revision 1: 62                                                                                                                                                              |
| Documentation               | 85    | Thorough; overclaims corrected; validation status recorded per scenario; caveats documented. Revision 1: 82                                                                                                                                                                             |
| npm packaging               | 87    | Clean tarball, correct entry points, corrected lockfile committed; CI still unproven. Revision 1: 85                                                                                                                                                                                    |
| Security / privacy          | 95    | No telemetry, no default endpoint, minimal permissions                                                                                                                                                                                                                                  |
| Maintainability             | 82    | Pure logic separated, consistent naming, docs for contributors                                                                                                                                                                                                                          |
| Competitive differentiation | 62    | Real but niche; weak without an endpoint, weaker on iOS                                                                                                                                                                                                                                 |

**Overall score: 72/100. Needs fixes before release.** (Revision 1: 68/100.)

The unweighted mean of the areas is 76 (revision 1: 73). The overall is held below the
mean because an untested platform is a release blocker for a package that advertises iOS
support. Android validation is substantially complete for the v0.1 scope; iOS remains the
primary release blocker because no iOS build or runtime validation has yet been performed.

---

## 21. Blockers

1. **iOS has never been built or run.** Run `pod install`, build the example app in
   Xcode, run `swift test` in `ios/`, and run the iOS checklist at least on a simulator
   (I1, I3, I9 to I12), plus Low Data Mode (I6) on a device.
2. **CI has never run.** Run the GitHub Actions workflow once (it also builds iOS on
   macOS) and get it green.
3. **Supported React Native range is undecided.** The peer range says `>=0.80.0` but
   only 0.86.2 has been tested. Either test the lower bound or raise the range.

**Resolved since revision 1:**

- Corrected `yarn.lock` committed (verified via the PC's git index).

## 22. High priority

No open Android item is high priority any more. Completed in revision 2:

- Gradle Kotlin unit tests: PASS.
- Android release build: PASS (R8 shrinking not exercised; see Medium).
- Android cellular (A2), airplane mode (A3), endpoint timeout (A4/A10), DNS failure (A9)
  and TLS failure (A11) on a physical device: PASS.
- Android monitoring on a physical device: PASS.

The remaining high-priority work is the blockers above (iOS, CI, React Native range).

## 23. Medium and low priority

**Medium:**

- Captive portal (A5): run on a real captive-portal network when one is available. It is
  an optional manual scenario, not a release blocker; the JS logic is unit-tested.
- Enable `minifyEnabled` in the example's release build once and confirm diagnostics still
  work, to verify R8 compatibility.
- Remaining Android scenarios: A6 metered Wi-Fi, A7 Data Saver, A8 slow network, A12 HTTP
  error, A13 VPN, A14 network switch mid-probe, A15 API 24/25, additional device models.
- Add Robolectric + MockWebServer tests for `EndpointProber` (no redirect follow, no body
  read, timeout and TLS codes).
- Surface Android monitoring registration failure to JS instead of only logging it.
- Decide on web: either add a `.web.ts` entry that rejects with `DIAGNOSTIC_UNAVAILABLE`,
  or keep "not supported".
- Hook: avoid a native stop/start when options change while monitoring; consider retrying
  a failed monitored refresh.

**Low:**

- Fix the Gradle `propName value` deprecations (`android/build.gradle:39` and the
  example's scaffold files).
- Remove `react-native.config.js` from `files`.
- Add an E2E smoke test (Maestro or Detox) for the example screen.
- Sign commits before the first push if a "Verified" badge matters.

## 24. Not tested

- iOS: everything (pod install, Xcode build, example app, Swift unit tests, simulator,
  physical device, Low Data Mode, captive portal and OS-validation behavior).
- Android: real captive portal (no captive-portal network available), VPN, metered Wi-Fi,
  Data Saver / constrained, HTTP error status, slow network, network switch in the
  middle of an active probe, API 24/25 devices, emulator, R8 shrinking (release build ran
  with minify off), runtime behavior of the release APK.
- Example Android app on any device other than the maintainer's phone (model and
  Android version not recorded).
- React Native versions other than 0.86.2; Expo development builds; `use_frameworks!`.
- GitHub Actions CI.
- Memory and leak profiling (Android Profiler, Xcode Instruments).

## 25. Recommended next steps

1. Done in revision 2: audit changes and `yarn.lock` committed; Gradle Kotlin tests,
   release build and the main Android scenarios run and recorded in
   `docs/MANUAL_TESTING.md`.
2. Get access to a Mac (or open a pull request to `main` and let CI build iOS). Fix any iOS
   compile errors, run `swift test`, and run the iOS checklist.
3. Run CI once and get it green.
4. Decide the supported React Native range and test its lower bound.
5. Optionally: captive portal on a real network, the remaining Android scenarios, and an
   R8-minified release build.
6. Re-run this audit's command list. Publish 0.1.0 only after the blockers are closed.

---

## Appendix: exact commands run during this audit

All commands ran in the auditor's Linux sandbox, on a copy verified identical to the PC,
unless noted.

| #   | Command                                                                                                                                                       | Result                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Copy 101 tracked text files and git refs from the PC; `diff` each against the sandbox (CR stripped)                                                           | 98 identical, 1 different (`example/src/App.tsx`, sandbox reset to match), 2 not copyable (scaffold Kotlin, path depth) |
| 2   | `git reset --hard 6de73ba` (sandbox only)                                                                                                                     | Sandbox matches the PC's committed content                                                                              |
| 3   | `yarn install --immutable`                                                                                                                                    | **FAIL** `YN0028` (lockfile would change)                                                                               |
| 4   | `yarn install`, then `diff` with the PC's `yarn.lock`                                                                                                         | Identical to the PC copy                                                                                                |
| 5   | `yarn install --immutable`                                                                                                                                    | PASS                                                                                                                    |
| 6   | `yarn typecheck`                                                                                                                                              | PASS (exit 0)                                                                                                           |
| 7   | `yarn lint`                                                                                                                                                   | PASS (exit 0)                                                                                                           |
| 8   | `yarn format`                                                                                                                                                 | PASS                                                                                                                    |
| 9   | `yarn test:coverage --ci`                                                                                                                                     | PASS, 156/156, statements 99.64%                                                                                        |
| 10  | `yarn prepare`                                                                                                                                                | PASS                                                                                                                    |
| 11  | `yarn codegen:check`                                                                                                                                          | PASS (Android and iOS)                                                                                                  |
| 12  | `npm pack --ignore-scripts --pack-destination ...` + `tar xzf` + file/entry-point checks                                                                      | PASS, 72 files, 53.1 kB; all entry points exist; no tests or examples                                                   |
| 13  | `tsc -p` on a temp consumer project using the extracted tarball                                                                                               | PASS                                                                                                                    |
| 14  | `kotlinc` (pure Kotlin + tests + JUnit stand-in) then `java ... RunnerKt`                                                                                     | 27 passed, 0 failed                                                                                                     |
| 15  | `grep` for markers, `console`, `any`, force unwraps, casts, URLs, secrets, log calls                                                                          | Findings in section 18; nothing suspicious                                                                              |
| 16  | `npm pack react-native-web` + `grep TurboModuleRegistry`                                                                                                      | 0 occurrences; web import would fail                                                                                    |
| 17  | `npm view <pkg> deprecated` for `eslint-plugin-ft-flow`, `del-cli`, `turbo`                                                                                   | Not deprecated                                                                                                          |
| 18  | After audit edits: `yarn typecheck`, `yarn lint`, `yarn format`, `yarn test`, `yarn install --immutable`                                                      | All PASS, 156/156                                                                                                       |
| 19  | Read from the PC: `.git/logs/HEAD`, `COMMIT_EDITMSG`, `app-debug.apk` metadata, Gradle problems report, library manifest merge report, compiled `.class` list | Evidence in sections 2, 10 and 12                                                                                       |

**Revision 2 additions:**

| #   | Command / action                                                                                                         | Where                      | Result                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------- |
| 20  | `.\gradlew :react-native-network-diagnostics:testDebugUnitTest`                                                          | Windows PC, by maintainer  | PASS (`BUILD SUCCESSFUL`, 29 tasks)                                                      |
| 21  | `.\gradlew :app:assembleRelease`                                                                                         | Windows PC, by maintainer  | PASS (`BUILD SUCCESSFUL`, 112 tasks)                                                     |
| 22  | Device scenarios A1, A2, A3, A4/A10, A9, A11, monitoring                                                                 | Maintainer's Android phone | PASS (values in `docs/MANUAL_TESTING.md`)                                                |
| 23  | Copied `.git/index`, `.git/logs/HEAD` from the PC; `GIT_INDEX_FILE=... git ls-files -s` compared with the sandbox commit | Sandbox                    | 121 files, identical blob hashes, including `yarn.lock`                                  |
| 24  | Listed `example/android/app/build/outputs` on the PC; read `example/android/app/build.gradle`                            | Sandbox (file access)      | `app-release.apk` present; no R8 mapping output; `enableProguardInReleaseBuilds = false` |

Not run anywhere: CocoaPods, Xcode, `swift test`, iOS simulator or device, CI, R8-minified
build.
