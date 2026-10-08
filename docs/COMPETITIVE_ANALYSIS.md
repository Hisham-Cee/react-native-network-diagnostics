# Competitive analysis

Research date: 2026-10-07. Versions and dates come from the npm registry on that day
(`npm view`, `npm pack`). Package contents were inspected from the published tarballs,
not from READMEs alone.

## Summary

- Connection state (type, connected, "is the internet reachable") is well covered by
  `@react-native-community/netinfo` and `expo-network`. This package does not try to
  replace them.
- Nothing maintained in the ecosystem answers "why is networking failing?" in a
  structured, cross-platform way: phase timings (DNS, TCP, TLS), normalized failure
  causes (DNS vs TLS vs timeout), OS validation and captive portal state, and
  Low Data Mode / Data Saver in one result.
- The name `react-native-network-diagnostics` was unclaimed on npm (404).

## Packages reviewed

| Package                           | Version (last publish) | Architecture                            | What it does                                                                                                                                                                                                                                                                                                                       | Overlap                                            |
| --------------------------------- | ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `@react-native-community/netinfo` | 12.0.1 (2026-02-14)    | TurboModule (`codegenConfig` present)   | Connection type, `isConnected`, `isInternetReachable`, SSID/BSSID, Wi-Fi strength (Android), cellular generation, `isConnectionExpensive`, listeners and hooks. Internet reachability is checked periodically against `reachabilityUrl` (default `https://clients3.google.com/generate_204`) on platforms without a native signal. | Type and connected state.                          |
| `expo-network`                    | 57.0.2 (2026-09-11)    | Expo Modules API                        | `getNetworkStateAsync` (type, `isConnected`, `isInternetReachable`), IP address, airplane mode (Android), listener and hook. Its own docs say `isInternetReachable` on iOS is always equal to `isConnected`; on Android it uses `NET_CAPABILITY_INTERNET` and `NET_CAPABILITY_VALIDATED`.                                          | Type and connected state, Android validation.      |
| `react-native-network-quality`    | 1.0.1 (2026-02-06)     | TurboModule                             | Claims throughput, packet loss and TCP-connect latency with a 0 to 100 score. The 1.0.1 tarball ships `ios/` but no `android/` directory.                                                                                                                                                                                          | Latency.                                           |
| `react-native-offline`            | 6.0.2 (2023-02-14)     | JavaScript on top of NetInfo            | Offline queueing and Redux integration; pings `https://www.google.com/` by default.                                                                                                                                                                                                                                                | Reachability ping.                                 |
| `react-native-ping`               | 1.2.8 (2023-09-15)     | Legacy bridge (`.m` module, no Codegen) | ICMP ping.                                                                                                                                                                                                                                                                                                                         | Latency (ICMP, not HTTP).                          |
| `react-native-network-info`       | 5.2.2 (2025-11-05)     | Legacy bridge (`.m` module, no Codegen) | IP address, SSID, gateway, subnet.                                                                                                                                                                                                                                                                                                 | None.                                              |
| `react-native-network-logger`     | 3.0.0 (2026-06-11)     | JavaScript                              | In-app HTTP traffic inspector for debugging.                                                                                                                                                                                                                                                                                       | None (it inspects traffic; this package does not). |

Searches for dedicated captive portal, DNS latency or "internet validation" React Native
packages returned no maintained results.

## What is missing in the ecosystem

1. **iOS has no "validated internet" signal** in any of the packages above. NetInfo and
   expo-network either probe a Google URL or mirror `isConnected`. Neither is wrong, but
   neither says _why_ a request would fail.
2. **No normalized failure cause.** Apps see `TypeError: Network request failed` from
   `fetch` and cannot tell DNS, TLS, timeout or "no route" apart.
3. **No phase timings.** No maintained package reports DNS, TCP and TLS time for a
   request on both platforms.
4. **Captive portal state** (Android `NET_CAPABILITY_CAPTIVE_PORTAL`) and **Data Saver /
   Low Data Mode** are not exposed by NetInfo or expo-network.

## Decisions for v1

| Feature                                                  | Decision                                         | Reason                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Connection type, connected                               | Included, minimal                                | Needed as context for the diagnosis. Kept small; NetInfo remains the right tool for SSID, cellular generation, signal strength.       |
| OS internet validation                                   | Included (Android), `undefined` on iOS           | Android has `NET_CAPABILITY_VALIDATED`. iOS has no public API, and inventing one would be misleading.                                 |
| Captive portal                                           | Included (Android OS signal), `undefined` on iOS | Same reason. A probe that fails with `TLS_FAILURE` on Wi-Fi is documented as a hint, not reported as a fact.                          |
| Metered / constrained                                    | Included                                         | Android metered + Data Saver; iOS `isExpensive` + `isConstrained`.                                                                    |
| HTTPS reachability and latency to the app's own endpoint | Included, the core feature                       | Nobody else measures DNS/TCP/TLS phases with normalized errors on both platforms.                                                     |
| Default probe endpoint                                   | **Not included**                                 | Contacting Google (or anyone) without the app opting in conflicts with the local-first goal. Without an endpoint, no request is made. |
| ICMP ping                                                | Not included                                     | Needs raw sockets or private APIs on iOS, and ICMP is often blocked; HTTP(S) latency reflects what apps actually do.                  |
| Throughput / speed test                                  | Not included                                     | Expensive in data and battery, and hard to make accurate. Out of scope for a lightweight diagnostic.                                  |
| Packet loss, jitter                                      | Not included                                     | Cannot be measured reliably from an app without raw sockets.                                                                          |
| SSID, IP address, cellular generation, signal strength   | Not included                                     | Already in NetInfo / expo-network / react-native-network-info; some need location permission.                                         |
| Continuous monitoring                                    | Opt-in only                                      | Observes OS events passively; never polls.                                                                                            |
