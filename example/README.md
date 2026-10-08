# Example app

Demonstrates `react-native-network-diagnostics` with a single diagnostics screen. It uses
the library from the repository root (Yarn workspace), so JavaScript changes reload
without a rebuild.

From the repository root:

```sh
yarn                 # install
yarn example start   # Metro
yarn example android # Android device or emulator
yarn example ios     # iOS simulator or device (macOS; run pod install in example/ios first)
```

The screen sends no request until you enter an endpoint or tap "Use sample endpoint"
(Google's public `https://clients3.google.com/generate_204`). See
[docs/MANUAL_TESTING.md](../docs/MANUAL_TESTING.md) for test scenarios.
