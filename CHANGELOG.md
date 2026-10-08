# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/). While the version is 0.x the API is
experimental and may change in minor releases.

## [0.1.0] - Unreleased

### Added

- `getNetworkDiagnostics`, `getNetworkState`, `addNetworkStateListener`.
- `useNetworkDiagnostics` hook with opt-in monitoring.
- HTTPS endpoint probe with DNS, TCP, TLS and total timings on Android (OkHttp) and iOS
  (URLSessionTaskMetrics).
- Android OS signals: validated internet, captive portal, metered, Data Saver, VPN.
- iOS OS signals: expensive (metered) and Low Data Mode (constrained).
- Documented, overridable quality classification.
- Normalized error codes across platforms.
