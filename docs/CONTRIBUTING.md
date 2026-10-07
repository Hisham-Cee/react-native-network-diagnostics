# Contributing

Contributions are welcome. Please read the [code of conduct](../CODE_OF_CONDUCT.md) and
keep the project's scope in mind: a small, honest set of network diagnostics. New
features need a reason they cannot live in an existing library (see
[COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md)) and must behave the same way, or be
`undefined`, on both platforms.

## Development setup

This is a Yarn 4 workspace monorepo: the library at the root and an example app in
`example/`. Use the Node version in [`.nvmrc`](../.nvmrc).

```sh
yarn                  # install (npm is not supported for development)
yarn example start    # Metro
yarn example android  # run the example on Android
yarn example ios      # run the example on iOS (macOS only)
```

JavaScript changes reload in the example app. Native changes need a rebuild.

- Android sources: open `example/android` in Android Studio, module
  `react-native-network-diagnostics`.
- iOS sources: open `example/ios/NetworkDiagnosticsExample.xcworkspace`, then
  `Pods > Development Pods > NetworkDiagnostics`.

## Checks

| Command                                                                               | What it does                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `yarn typecheck`                                                                      | TypeScript, strict                                                               |
| `yarn lint`                                                                           | ESLint + Prettier rules (`yarn lint --fix` to fix)                               |
| `yarn format`                                                                         | Prettier check for sources and docs (`yarn format:fix` to fix)                   |
| `yarn test`                                                                           | Jest unit tests (`yarn test:coverage` for coverage)                              |
| `yarn codegen:check`                                                                  | Runs React Native Codegen for both platforms and checks the generated interfaces |
| `yarn prepare`                                                                        | Builds `lib/` with react-native-builder-bob                                      |
| `cd example/android && ./gradlew :react-native-network-diagnostics:testDebugUnitTest` | Kotlin unit tests (JVM)                                                          |
| `cd ios && swift test`                                                                | Swift unit tests (macOS)                                                         |
| `npm pack --dry-run`                                                                  | Shows what would be published                                                    |

CI runs all of the above, plus full example builds for Android and iOS.

## Code guidelines

- Changing `src/NativeNetworkDiagnostics.ts` changes the native contract. Update both
  native implementations, run `yarn codegen:check`, and rebuild the example app.
- Do not commit generated Codegen output (`android/generated`, `ios/generated`).
- Keep platform types (NetworkCapabilities, NWPath, OkHttp, URLSession) at the edges and
  put logic in the pure mapping files, with tests.
- No new runtime dependencies without discussion.
- Never add default network endpoints, telemetry or anything that sends data the app did
  not explicitly configure.
- Run the relevant scenarios in [MANUAL_TESTING.md](MANUAL_TESTING.md) for native changes
  and state which ones you ran in the pull request.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
`test:`, `refactor:`, `chore:`.

## Pull requests

- Small, focused changes.
- All checks passing.
- Docs updated for any API or behavior change.
- Open an issue first for API changes.

## Releasing (maintainers)

Publishing is manual. Before `npm publish`, run every check above, inspect
`npm pack --dry-run`, run the manual test matrix on at least one real Android and one real
iOS device, update the version in `package.json` and add a changelog entry.
