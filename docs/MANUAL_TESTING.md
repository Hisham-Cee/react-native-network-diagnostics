# Manual testing

Automated tests cover the TypeScript layer and the pure native mapping code. Everything
that depends on a real radio, a real OS network stack or a real server must be checked on
devices with the example app. Record the date, device, OS version and result next to each
item when you run them.

Status values used below: **PASS** (executed and matched the expected result), **NOT RUN**
(not executed yet). Anything not marked PASS has not been verified.

## Current status

| Area                                                    | Status                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android, physical device                                | A1, A2, A3, A4, A9, A10, A11 and network monitoring PASS. Other scenarios NOT RUN.                                                                                  |
| Android captive portal (A5)                             | NOT RUN. Not manually verified because a real captive-portal network was not available during validation. The logic is covered by JS unit tests only.               |
| Android Gradle unit tests                               | PASS                                                                                                                                                                |
| Android release build of the example app                | PASS. R8 code shrinking was **not** exercised: the example has `enableProguardInReleaseBuilds = false` (React Native template default), so `minifyEnabled` was off. |
| iOS (all of I1 to I14, simulator, device, `swift test`) | NOT RUN. No iOS build or runtime validation has been performed.                                                                                                     |
| Leak and lifecycle checks                               | NOT RUN                                                                                                                                                             |

Android results were recorded with React Native 0.86.2 on one physical Android phone
(model and Android version not recorded). Round 1 was run on 2026-10-07. Round 2 ran
after the final implementation audit (the release APK it produced is timestamped
2026-10-07 16:04 IST) and was recorded on 2026-10-08.

### Error codes observed on a real Android device

| Code                 | Status               | Evidence                                                                                                                                                                                                                                                    |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DNS_FAILURE`        | PASS                 | A9                                                                                                                                                                                                                                                          |
| `TLS_FAILURE`        | PASS                 | A11                                                                                                                                                                                                                                                         |
| `TIMEOUT`            | PASS                 | A4 / A10                                                                                                                                                                                                                                                    |
| `CONNECTION_FAILURE` | PASS (offline path)  | A3. In this path the JS layer reports `CONNECTION_FAILURE` without sending a request, because the OS reports no connection. The native mapping of refused or unreachable connections (`ConnectException` and similar) is covered by Kotlin unit tests only. |
| `INVALID_ENDPOINT`   | Automated tests only | Not exercised manually on a device.                                                                                                                                                                                                                         |
| `UNKNOWN`            | Automated tests only |                                                                                                                                                                                                                                                             |

## Setup

```sh
yarn                      # from the repository root
yarn example start        # Metro

# Android (device or emulator, USB debugging on)
yarn example android

# iOS (macOS only)
cd example/ios && bundle install && bundle exec pod install && cd ../..
yarn example ios          # or open example/ios/NetworkDiagnosticsExample.xcworkspace
```

Endpoints for the scenarios:

- **Your backend**: a health endpoint you control, for example
  `https://api.example.com/health`.
- **Sample**: the "Use sample endpoint" button fills
  `https://clients3.google.com/generate_204` (expects HTTP 204).
- **Unreachable host**: `https://does-not-exist.invalid/` (DNS must fail).
- **Black hole (timeout)**: `https://10.255.255.1/` (a non-routable address; the TCP
  connect should hang until `timeoutMs`).
- **Bad certificate**: `https://expired.badssl.com/`.

## Smoke checks (both platforms)

- [ ] App starts, no red box, Metro log shows `"fabric":true` (New Architecture).
- [ ] With no endpoint: Run Diagnostics shows connection, type, conditions; latency shows
      "Not measured"; quality is `UNKNOWN` (or `OFFLINE`); no request in a proxy log.
- [x] With the sample endpoint: reachable Yes, HTTP 204, HTTPS/DNS/TCP/TLS values shown.
      **Android: PASS** (see A1, A2). iOS: NOT RUN.
- [x] Toggle "Monitor network changes" on, switch networks, result refreshes about 1 s
      after the change. Toggle off, switch networks, no refresh.
      **Android: PASS** (confirmed by the maintainer on a physical device across network
      changes). iOS: NOT RUN.
- [ ] Press Run Diagnostics repeatedly and quickly: no crash, last result wins.
- [ ] Background the app for 5 minutes with monitoring on, return: no crash.

## Android checklist

| #   | Scenario                     | How to set it up                                                              | Expected                                                                                                                                     | Result                                                                                                                                                                                                                               |
| --- | ---------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Wi-Fi                        | Connect to working Wi-Fi                                                      | `type: wifi`, `validated: true`, `captivePortal: false`, quality not `offline`                                                               | PASS. 2026-10-07: wifi, validated, no portal, HTTP 204, HTTPS 352 ms, GOOD. Round 2: connected, wifi, VPN no, validated, no portal, HTTP 204, HTTPS 386 / DNS 58 / TCP 50 / TLS 112 ms, GOOD.                                        |
| A2  | Cellular                     | Wi-Fi off, mobile data on                                                     | `type: cellular`, `metered: true`                                                                                                            | PASS, round 2: connected, cellular, VPN no, validated, no portal, HTTP 204, metered yes, constrained no, HTTPS 388 / DNS 12 / TCP 79 / TLS 123 ms, GOOD.                                                                             |
| A3  | Airplane mode                | `adb shell cmd connectivity airplane-mode enable` (API 30+) or quick settings | `connected: false`, `type: none`, quality `offline`, endpoint error `CONNECTION_FAILURE`, no request sent                                    | PASS, round 2: disconnected, type none, VPN no, validated no, no portal, not reachable, no HTTP status, `CONNECTION_FAILURE`, all timings "Not measured" (no probe sent), OFFLINE.                                                   |
| A4  | Wi-Fi without internet       | Phone on a router with WAN unplugged, or a hotspot with no upstream           | `connected: true`, `validated: false`; with endpoint: `reachable: false`, error `DNS_FAILURE`/`TIMEOUT`/`CONNECTION_FAILURE`, quality `poor` | PASS, round 2 (endpoint-timeout variant): connected, wifi, validated no in this capture, no portal, not reachable, `TIMEOUT`, timings not measured, POOR. How the no-response condition was produced was not recorded.               |
| A5  | Captive portal               | Real public Wi-Fi before sign-in                                              | `captivePortal: true`, `validated: false`, quality `offline`; probe likely `TLS_FAILURE`                                                     | NOT RUN. Not manually verified because a real captive-portal network was not available during validation.                                                                                                                            |
| A6  | Metered Wi-Fi                | Settings > Network > Wi-Fi > (network) > Metered                              | `type: wifi`, `metered: true`                                                                                                                | NOT RUN                                                                                                                                                                                                                              |
| A7  | Data Saver                   | Settings > Network > Data Saver on, on cellular or metered Wi-Fi              | `constrained: true`; turn off and Run again: `false`                                                                                         | NOT RUN                                                                                                                                                                                                                              |
| A8  | Slow network                 | Emulator: `adb emu network delay gprs` and `adb emu network speed gsm`        | Higher `httpsMs`, quality `fair`/`poor`                                                                                                      | NOT RUN                                                                                                                                                                                                                              |
| A9  | Backend unreachable          | Unreachable host endpoint                                                     | `DNS_FAILURE`, quality `poor`, no crash                                                                                                      | PASS, round 2 with `https://clients3.google.invalid`: connected, wifi, VPN no, validated yes, no portal, not reachable, `DNS_FAILURE`, timings not measured, POOR. The device itself had working internet; only the endpoint failed. |
| A10 | Timeout                      | Black hole endpoint, `timeoutMs` 2000                                         | `TIMEOUT` after about 2 s                                                                                                                    | PASS, round 2: `TIMEOUT` code and POOR observed in the A4 run. The black-hole endpoint and the 2 s timing were not separately recorded.                                                                                              |
| A11 | TLS failure                  | Bad certificate endpoint                                                      | `TLS_FAILURE`                                                                                                                                | PASS, round 2: deliberately invalid certificate endpoint showed `TLS_FAILURE`. Timings and other fields not recorded.                                                                                                                |
| A12 | HTTP error                   | Endpoint returning 500                                                        | `reachable: true`, `statusCode: 500`, quality from latency                                                                                   | NOT RUN                                                                                                                                                                                                                              |
| A13 | VPN                          | Any VPN app on                                                                | `vpn: true`, `type` still the physical transport                                                                                             | NOT RUN                                                                                                                                                                                                                              |
| A14 | Network switch while probing | Start a 5-sample run, switch Wi-Fi to cellular                                | Result or structured error, no crash                                                                                                         | NOT RUN                                                                                                                                                                                                                              |
| A15 | API 24/25 device or emulator | Run A1 to A3                                                                  | Same results (no `NOT_SUSPENDED`/`TEMPORARILY_NOT_METERED` there)                                                                            | NOT RUN                                                                                                                                                                                                                              |

## iOS checklist

| #   | Scenario               | How to set it up                                                                                                   | Expected                                                                             | Result  |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------- |
| I1  | Wi-Fi                  | Connect to working Wi-Fi                                                                                           | `type: wifi`, `validated`/`captivePortal`/`vpn` shown as not available               | NOT RUN |
| I2  | Cellular               | Wi-Fi off, cellular on (device only)                                                                               | `type: cellular`, `metered: true`                                                    | NOT RUN |
| I3  | Airplane mode          | Control Center                                                                                                     | `connected: false`, quality `offline`, no request sent                               | NOT RUN |
| I4  | Wi-Fi without internet | Router with WAN unplugged                                                                                          | `connected: true`; probe fails (`DNS_FAILURE`/`TIMEOUT`), quality `poor`             | NOT RUN |
| I5  | Captive portal         | Public Wi-Fi before sign-in; dismiss the system sheet with "Use Other Network" > "Use Without Internet" if offered | `captivePortal` not available; probe likely `TLS_FAILURE` or a `3xx`; quality `poor` | NOT RUN |
| I6  | Low Data Mode          | Settings > Wi-Fi > (i) > Low Data Mode (or Cellular > Data Mode)                                                   | `constrained: true`                                                                  | NOT RUN |
| I7  | Personal hotspot       | Join another iPhone's hotspot                                                                                      | `metered: true` (`isExpensive`)                                                      | NOT RUN |
| I8  | Slow network           | Settings > Developer > Network Link Conditioner > 3G or Very Bad Network                                           | Higher `httpsMs`, quality `fair`/`poor`                                              | NOT RUN |
| I9  | Backend unreachable    | Unreachable host endpoint                                                                                          | `DNS_FAILURE`                                                                        | NOT RUN |
| I10 | Timeout                | Black hole endpoint, `timeoutMs` 2000                                                                              | `TIMEOUT` after about 2 s                                                            | NOT RUN |
| I11 | TLS failure            | Bad certificate endpoint                                                                                           | `TLS_FAILURE`                                                                        | NOT RUN |
| I12 | HTTP error             | Endpoint returning 500                                                                                             | `reachable: true`, `statusCode: 500`                                                 | NOT RUN |
| I13 | VPN                    | Any VPN profile on                                                                                                 | `type` remains the physical transport, `vpn` not available                           | NOT RUN |
| I14 | Simulator              | Run I1, I3 (toggle Mac Wi-Fi)                                                                                      | Simulator reflects the Mac's network; `type` may be `wifi` or `ethernet`             | NOT RUN |

## Leak and lifecycle checks

- [ ] Android Studio Profiler: toggle monitoring 50 times; no growth in
      `ConnectivityManager$NetworkCallback` instances.
- [ ] Xcode Instruments (Leaks/Allocations): run 50 diagnostics with the sample endpoint;
      no growing `URLSession` or `NetworkDiagnosticsImpl.ProbeDelegate` instances.
- [ ] Reload JS (press `r` in Metro) with monitoring on: no crash, monitoring works after
      reload (native `invalidate` stops the old monitor).

## Native unit tests and builds

| Check                      | Command                                                                             | Status                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kotlin unit tests (Gradle) | `cd example/android; .\gradlew :react-native-network-diagnostics:testDebugUnitTest` | PASS (Windows, JDK 17): `BUILD SUCCESSFUL`, 29 actionable tasks (5 executed, 24 up-to-date)                                                                                                                                                                                                                 |
| Android release build      | `cd example/android; .\gradlew :app:assembleRelease`                                | PASS (Windows, JDK 17): `BUILD SUCCESSFUL`, 112 actionable tasks (97 executed, 15 up-to-date); `app-release.apk` produced. R8 minification was off (`enableProguardInReleaseBuilds = false`), so shrinking/obfuscation compatibility is NOT VERIFIED. Runtime behavior of the release APK was not recorded. |
| Swift unit tests           | `cd ios && swift test`                                                              | NOT RUN (requires macOS)                                                                                                                                                                                                                                                                                    |

Both Gradle runs printed two warnings that did not affect the result: an invalid Java 11
installation registered in Windows (`C:\Program Files\Eclipse Adoptium\jdk-11.0.26.4-hotspot`,
the build used JDK 17), and Gradle's standard notice that deprecated features make the
build incompatible with Gradle 10.

```sh
# Android (JVM, no device needed): requires the Android SDK and JDK 17
cd example/android && ./gradlew :react-native-network-diagnostics:testDebugUnitTest

# iOS (macOS with Xcode command line tools)
cd ios && swift test
```
