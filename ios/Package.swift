// swift-tools-version:5.9
//
// Test-only SwiftPM package for the pure Swift logic in ios/Core.
// It is excluded from the CocoaPods pod and from the npm package.
//
// Run on macOS (Xcode command line tools) from the ios/ directory:
//   swift test
import PackageDescription

let package = Package(
  name: "NetworkDiagnosticsCore",
  platforms: [.macOS(.v12), .iOS(.v15)],
  targets: [
    .target(name: "NetworkDiagnosticsCore", path: "Core"),
    .testTarget(
      name: "NetworkDiagnosticsCoreTests",
      dependencies: ["NetworkDiagnosticsCore"],
      path: "Tests/NetworkDiagnosticsCoreTests"
    ),
  ]
)
