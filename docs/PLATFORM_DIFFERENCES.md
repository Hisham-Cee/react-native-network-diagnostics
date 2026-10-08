# Platform differences

The API is the same on iOS and Android. Where a platform has no API for a value, the
field is `undefined`. Nothing is inferred or faked to reach parity.

| Field                                     | Android                                                            | iOS                                                             | Why they differ                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connected`                               | Active network exists and is not suspended                         | `NWPath.status == .satisfied`                                   | Different OS models; both mean "the OS has a usable route". `.requiresConnection` (for example on-demand VPN not up) counts as not connected.                                                                              |
| `type`                                    | From transports; VPN reported separately                           | From interface types                                            | iOS reports VPN tunnels as `.other` interfaces next to the physical one, so `type` stays the physical transport.                                                                                                           |
| `vpn`                                     | `TRANSPORT_VPN`                                                    | `undefined`                                                     | iOS has no public API that reliably reports a VPN. Heuristics based on interface names (`utun`, `ipsec`) also match system tunnels and are not used.                                                                       |
| `internet.validated`                      | `NET_CAPABILITY_VALIDATED`                                         | `undefined`                                                     | iOS does not expose its internal connectivity validation to apps. Use an `endpoint` probe to verify reachability.                                                                                                          |
| `internet.captivePortal`                  | `NET_CAPABILITY_CAPTIVE_PORTAL`                                    | `undefined`                                                     | iOS handles captive portals in the system Captive Network Assistant and does not tell apps. A probe failing with `TLS_FAILURE`, or returning `3xx`/`200` where you expect `204`, on Wi-Fi is a strong hint, but not proof. |
| `conditions.metered`                      | Not `NOT_METERED` and not `TEMPORARILY_NOT_METERED`                | `NWPath.isExpensive`                                            | Android lets the user mark Wi-Fi as metered. iOS marks cellular and personal hotspot as expensive.                                                                                                                         |
| `conditions.constrained`                  | Data Saver is on and restricts this app (only on metered networks) | `NWPath.isConstrained` (Low Data Mode)                          | Closest equivalents. Android Data Saver changes are picked up at the next state read or network event, not via a dedicated broadcast.                                                                                      |
| `latency.httpsMs`                         | OkHttp `callStart` to `responseHeadersEnd`                         | `URLSessionTaskMetrics` `fetchStartDate` to `responseStartDate` | Same definition, different clocks. iOS falls back to wall-clock time to `didReceiveResponse` if metrics are missing.                                                                                                       |
| `latency.dnsMs`                           | OkHttp `dnsStart`/`dnsEnd` (system resolver)                       | `domainLookupStartDate`/`EndDate`                               | Both may be served from the OS resolver cache. Android Private DNS (DNS over TLS) time is included.                                                                                                                        |
| `latency.tcpConnectMs` / `tlsHandshakeMs` | OkHttp connect and secure-connect events                           | Transaction metrics                                             | When a proxy is configured, both measure the connection to the proxy.                                                                                                                                                      |
| Event delivery                            | `registerDefaultNetworkCallback` (API 24+)                         | `NWPathMonitor`                                                 | Both de-duplicated natively.                                                                                                                                                                                               |

## Version notes

- **Android**: minimum SDK 24 (React Native's minimum). `TEMPORARILY_NOT_METERED` needs
  API 30 and `NOT_SUSPENDED` needs API 28; on older versions they are treated as absent.
- **iOS**: React Native 0.80+ requires iOS 15.1 or later, so `NWPathMonitor`
  (iOS 12) and `isConstrained` (iOS 13) are always available.

## Why some fields are `undefined`

A field that is `false` on one platform and invented on the other would be worse than no
field: code like `if (!state.internet.validated) showOfflineBanner()` would fire on every
iOS device. Check for `undefined` explicitly, or combine with an endpoint probe:

```ts
const d = await getNetworkDiagnostics({ endpoint });
const hasInternet =
  d.endpoint?.reachable ?? d.internet.validated ?? d.connected;
```

## Permissions

| Platform | Permission             | Type                             |
| -------- | ---------------------- | -------------------------------- |
| Android  | `ACCESS_NETWORK_STATE` | Normal (install-time, no prompt) |
| Android  | `INTERNET`             | Normal (install-time, no prompt) |
| iOS      | none                   |                                  |

No location permission is needed because the package does not read SSID, BSSID or
cellular details. iOS 14+ Local Network permission is not triggered unless your endpoint
is on the local network.
