package com.networkdiagnostics

import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.cert.CertificateException
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProbeErrorMapperTest {
  @Test
  fun dnsFailure() {
    assertEquals("DNS_FAILURE", ProbeErrorMapper.codeFor(UnknownHostException("Unable to resolve host")))
  }

  @Test
  fun timeouts() {
    assertEquals("TIMEOUT", ProbeErrorMapper.codeFor(SocketTimeoutException("connect timed out")))
    // OkHttp callTimeout
    assertEquals("TIMEOUT", ProbeErrorMapper.codeFor(InterruptedIOException("timeout")))
  }

  @Test
  fun tlsFailures() {
    assertEquals("TLS_FAILURE", ProbeErrorMapper.codeFor(SSLHandshakeException("handshake failed")))
    assertEquals("TLS_FAILURE", ProbeErrorMapper.codeFor(SSLPeerUnverifiedException("Hostname not verified")))
    assertEquals("TLS_FAILURE", ProbeErrorMapper.codeFor(CertificateException("bad cert")))
  }

  @Test
  fun connectionFailures() {
    assertEquals("CONNECTION_FAILURE", ProbeErrorMapper.codeFor(ConnectException("Failed to connect")))
    assertEquals("CONNECTION_FAILURE", ProbeErrorMapper.codeFor(NoRouteToHostException("No route")))
    assertEquals("CONNECTION_FAILURE", ProbeErrorMapper.codeFor(SocketException("Connection reset")))
  }

  @Test
  fun walksTheCauseChain() {
    val wrapped = IOException("unexpected end of stream", UnknownHostException("x"))
    assertEquals("DNS_FAILURE", ProbeErrorMapper.codeFor(wrapped))
    val tls = IOException("outer", IOException("middle", SSLHandshakeException("inner")))
    assertEquals("TLS_FAILURE", ProbeErrorMapper.codeFor(tls))
  }

  @Test
  fun outermostRecognizedCauseWins() {
    val timeoutWrappingReset = SocketTimeoutException("timeout").apply {
      initCause(SocketException("reset"))
    }
    assertEquals("TIMEOUT", ProbeErrorMapper.codeFor(timeoutWrappingReset))
  }

  @Test
  fun invalidEndpoint() {
    assertEquals("INVALID_ENDPOINT", ProbeErrorMapper.codeFor(IllegalArgumentException("unexpected url")))
  }

  @Test
  fun unknownErrors() {
    assertEquals("UNKNOWN", ProbeErrorMapper.codeFor(IOException("something else")))
    assertEquals("UNKNOWN", ProbeErrorMapper.codeFor(IllegalStateException("x")))
  }

  @Test
  fun cyclicCauseChainTerminates() {
    val a = IOException("a")
    val b = IOException("b", a)
    a.initCause(b)
    assertEquals("UNKNOWN", ProbeErrorMapper.codeFor(a))
  }

  @Test
  fun messages() {
    assertEquals("UnknownHostException: host", ProbeErrorMapper.messageFor(UnknownHostException("host")))
    assertEquals("IOException", ProbeErrorMapper.messageFor(IOException()))
    assertTrue(ProbeErrorMapper.messageFor(IOException("x".repeat(1000))).length < 350)
  }
}
