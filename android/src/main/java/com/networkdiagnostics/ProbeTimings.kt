package com.networkdiagnostics

/**
 * Monotonic timestamps (System.nanoTime) collected by the OkHttp
 * EventListener for one request. Pure data, unit tested.
 */
class ProbeTimings {
  @Volatile var callStart: Long? = null
  @Volatile var dnsStart: Long? = null
  @Volatile var dnsEnd: Long? = null
  @Volatile var connectStart: Long? = null
  @Volatile var secureConnectStart: Long? = null
  @Volatile var secureConnectEnd: Long? = null
  @Volatile var connectEnd: Long? = null
  @Volatile var responseHeadersEnd: Long? = null

  /** Request start to response headers received. */
  fun totalMs(): Double? = durationMs(callStart, responseHeadersEnd)

  /** Hostname resolution. */
  fun dnsMs(): Double? = durationMs(dnsStart, dnsEnd)

  /** TCP handshake only: connect start until TLS starts (or connect ends for plain TCP). */
  fun tcpConnectMs(): Double? = durationMs(connectStart, secureConnectStart ?: connectEnd)

  /** TLS handshake. */
  fun tlsHandshakeMs(): Double? = durationMs(secureConnectStart, secureConnectEnd)

  companion object {
    private const val NANOS_PER_MS = 1_000_000.0

    fun durationMs(start: Long?, end: Long?): Double? {
      if (start == null || end == null || end < start) {
        return null
      }
      return (end - start) / NANOS_PER_MS
    }
  }
}
