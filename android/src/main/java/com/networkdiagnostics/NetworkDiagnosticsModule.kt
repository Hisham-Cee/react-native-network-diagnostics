package com.networkdiagnostics

import com.facebook.react.bridge.ReactApplicationContext

class NetworkDiagnosticsModule(reactContext: ReactApplicationContext) :
  NativeNetworkDiagnosticsSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeNetworkDiagnosticsSpec.NAME
  }
}
