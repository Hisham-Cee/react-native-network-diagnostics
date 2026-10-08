package com.networkdiagnostics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProbeTimingsTest {
  private val ms = 1_000_000L

  @Test
  fun fullHttpsTimeline() {
    val t = ProbeTimings().apply {
      callStart = 0
      dnsStart = 1 * ms
      dnsEnd = 6 * ms
      connectStart = 6 * ms
      secureConnectStart = 26 * ms
      secureConnectEnd = 61 * ms
      connectEnd = 61 * ms
      responseHeadersEnd = 82 * ms
    }
    assertEquals(82.0, t.totalMs()!!, 0.0001)
    assertEquals(5.0, t.dnsMs()!!, 0.0001)
    assertEquals(20.0, t.tcpConnectMs()!!, 0.0001)
    assertEquals(35.0, t.tlsHandshakeMs()!!, 0.0001)
  }

  @Test
  fun missingPhasesAreNull() {
    val t = ProbeTimings().apply {
      callStart = 0
      responseHeadersEnd = 10 * ms
    }
    assertEquals(10.0, t.totalMs()!!, 0.0001)
    assertNull(t.dnsMs())
    assertNull(t.tcpConnectMs())
    assertNull(t.tlsHandshakeMs())
  }

  @Test
  fun tcpFallsBackToConnectEndWithoutTls() {
    val t = ProbeTimings().apply {
      connectStart = 5 * ms
      connectEnd = 15 * ms
    }
    assertEquals(10.0, t.tcpConnectMs()!!, 0.0001)
  }

  @Test
  fun negativeDurationsAreRejected() {
    assertNull(ProbeTimings.durationMs(10, 5))
    assertNull(ProbeTimings.durationMs(null, 5))
    assertEquals(0.0, ProbeTimings.durationMs(5, 5)!!, 0.0)
  }

  @Test
  fun noResponseMeansNoTotal() {
    val t = ProbeTimings().apply { callStart = 0 }
    assertNull(t.totalMs())
  }
}
