#import <NetworkDiagnosticsSpec/NetworkDiagnosticsSpec.h>

/**
 * TurboModule entry point. Conforms to the Codegen-generated protocol and
 * inherits the generated base class that provides `emitOnNetworkStateChange:`.
 * All logic lives in Swift (NetworkDiagnosticsImpl.swift).
 */
@interface NetworkDiagnostics : NativeNetworkDiagnosticsSpecBase <NativeNetworkDiagnosticsSpec>

@end
