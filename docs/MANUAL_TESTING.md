# Manual testing

Automated tests cover the TypeScript layer and the pure native mapping code. Everything
that depends on a real radio, a real OS network stack or a real server must be checked on
devices with the example app. Only A1 and the monitoring smoke check have been executed so
far (see their Result entries); everything else is still open.
Record the date, device, OS version and result next to each item when you run them.

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
- [ ] With the sample endpoint: reachable Yes, HTTP 204, HTTPS/DNS/TCP/TLS values shown.
- [ ] Toggle "Monitor network changes" on, switch networks, result refreshes about 1 s
      after the change. Toggle off, switch networks, no refresh.
      (Reported working by the tester on 2026-10-07 on Android; no screenshot recorded.)
- [ ] Press Run Diagnostics repeatedly and quickly: no crash, last result wins.
- [ ] Background the app for 5 minutes with monitoring on, return: no crash.

## Android checklist

| #   | Scenario                     | How to set it up                                                              | Expected                                                                                                                                     | Result                                                                                                             |
| --- | ---------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A1  | Wi-Fi                        | Connect to working Wi-Fi                                                      | `type: wifi`, `validated: true`, `captivePortal: false`, quality not `offline`                                                               | PASS 2026-10-07, Android phone (model not recorded), RN 0.86.2: wifi, validated, no portal, HTTP 204, 352 ms, GOOD |
| A2  | Cellular                     | Wi-Fi off, mobile data on                                                     | `type: cellular`, `metered: true`                                                                                                            |                                                                                                                    |
| A3  | Airplane mode                | `adb shell cmd connectivity airplane-mode enable` (API 30+) or quick settings | `connected: false`, `type: none`, quality `offline`, endpoint error `CONNECTION_FAILURE`, no request sent                                    |                                                                                                                    |
| A4  | Wi-Fi without internet       | Phone on a router with WAN unplugged, or a hotspot with no upstream           | `connected: true`, `validated: false`; with endpoint: `reachable: false`, error `DNS_FAILURE`/`TIMEOUT`/`CONNECTION_FAILURE`, quality `poor` |                                                                                                                    |
| A5  | Captive portal               | Real public Wi-Fi before sign-in                                              | `captivePortal: true`, `validated: false`, quality `offline`; probe likely `TLS_FAILURE`                                                     |                                                                                                                    |
| A6  | Metered Wi-Fi                | Settings > Network > Wi-Fi > (network) > Metered                              | `type: wifi`, `metered: true`                                                                                                                |                                                                                                                    |
| A7  | Data Saver                   | Settings > Network > Data Saver on, on cellular or metered Wi-Fi              | `constrained: true`; turn off and Run again: `false`                                                                                         |                                                                                                                    |
| A8  | Slow network                 | Emulator: `adb emu network delay gprs` and `adb emu network speed gsm`        | Higher `httpsMs`, quality `fair`/`poor`                                                                                                      |                                                                                                                    |
| A9  | Backend unreachable          | Unreachable host endpoint                                                     | `DNS_FAILURE`, quality `poor`, no crash                                                                                                      |                                                                                                                    |
| A10 | Timeout                      | Black hole endpoint, `timeoutMs` 2000                                         | `TIMEOUT` after about 2 s                                                                                                                    |                                                                                                                    |
| A11 | TLS failure                  | Bad certificate endpoint                                                      | `TLS_FAILURE`                                                                                                                                |                                                                                                                    |
| A12 | HTTP error                   | Endpoint returning 500                                                        | `reachable: true`, `statusCode: 500`, quality from latency                                                                                   |                                                                                                                    |
| A13 | VPN                          | Any VPN app on                                                                | `vpn: true`, `type` still the physical transport                                                                                             |                                                                                                                    |
| A14 | Network switch while probing | Start a 5-sample run, switch Wi-Fi to cellular                                | Result or structured error, no crash                                                                                                         |                                                                                                                    |
| A15 | API 24/25 device or emulator | Run A1 to A3                                                                  | Same results (no `NOT_SUSPENDED`/`TEMPORARILY_NOT_METERED` there)                                                                            |                                                                                                                    |

## iOS checklist

| #   | Scenario               | How to set it up                                                                                                   | Expected                                                                             | Result |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------ |
| I1  | Wi-Fi                  | Connect to working Wi-Fi                                                                                           | `type: wifi`, `validated`/`captivePortal`/`vpn` shown as not available               |        |
| I2  | Cellular               | Wi-Fi off, cellular on (device only)                                                                               | `type: cellular`, `metered: true`                                                    |        |
| I3  | Airplane mode          | Control Center                                                                                                     | `connected: false`, quality `offline`, no request sent                               |        |
| I4  | Wi-Fi without internet | Router with WAN unplugged                                                                                          | `connected: true`; probe fails (`DNS_FAILURE`/`TIMEOUT`), quality `poor`             |        |
| I5  | Captive portal         | Public Wi-Fi before sign-in; dismiss the system sheet with "Use Other Network" > "Use Without Internet" if offered | `captivePortal` not available; probe likely `TLS_FAILURE` or a `3xx`; quality `poor` |        |
| I6  | Low Data Mode          | Settings > Wi-Fi > (i) > Low Data Mode (or Cellular > Data Mode)                                                   | `constrained: true`                                                                  |        |
| I7  | Personal hotspot       | Join another iPhone's hotspot                                                                                      | `metered: true` (`isExpensive`)                                                      |        |
| I8  | Slow network           | Settings > Developer > Network Link Conditioner > 3G or Very Bad Network                                           | Higher `httpsMs`, quality `fair`/`poor`                                              |        |
| I9  | Backend unreachable    | Unreachable host endpoint                                                                                          | `DNS_FAILURE`                                                                        |        |
| I10 | Timeout                | Black hole endpoint, `timeoutMs` 2000                                                                              | `TIMEOUT` after about 2 s                                                            |        |
| I11 | TLS failure            | Bad certificate endpoint                                                                                           | `TLS_FAILURE`                                                                        |        |
| I12 | HTTP error             | Endpoint returning 500                                                                                             | `reachable: true`, `statusCode: 500`                                                 |        |
| I13 | VPN                    | Any VPN profile on                                                                                                 | `type` remains the physical transport, `vpn` not available                           |        |
| I14 | Simulator              | Run I1, I3 (toggle Mac Wi-Fi)                                                                                      | Simulator reflects the Mac's network; `type` may be `wifi` or `ethernet`             |        |

## Leak and lifecycle checks

- [ ] Android Studio Profiler: toggle monitoring 50 times; no growth in
      `ConnectivityManager$NetworkCallback` instances.
- [ ] Xcode Instruments (Leaks/Allocations): run 50 diagnostics with the sample endpoint;
      no growing `URLSession` or `NetworkDiagnosticsImpl.ProbeDelegate` instances.
- [ ] Reload JS (press `r` in Metro) with monitoring on: no crash, monitoring works after
      reload (native `invalidate` stops the old monitor).

## Native unit tests

```sh
# Android (JVM, no device needed): requires the Android SDK and JDK 17
cd example/android && ./gradlew :react-native-network-diagnostics:testDebugUnitTest

# iOS (macOS with Xcode command line tools)
cd ios && swift test
```
