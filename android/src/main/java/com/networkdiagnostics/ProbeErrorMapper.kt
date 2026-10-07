package com.networkdiagnostics

import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.PortUnreachableException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.security.cert.CertificateException
import javax.net.ssl.SSLException

/**
 * Maps JVM/OkHttp exceptions to the normalized error codes shared with iOS
 * and JS (see src/errors.ts). Pure JVM, unit tested.
 */
object ProbeErrorMapper {
  const val TIMEOUT = "TIMEOUT"
  const val DNS_FAILURE = "DNS_FAILURE"
  const val CONNECTION_FAILURE = "CONNECTION_FAILURE"
  const val TLS_FAILURE = "TLS_FAILURE"
  const val INVALID_ENDPOINT = "INVALID_ENDPOINT"
  const val DIAGNOSTIC_UNAVAILABLE = "DIAGNOSTIC_UNAVAILABLE"
  const val UNKNOWN = "UNKNOWN"

  private const val MAX_CAUSE_DEPTH = 8

  /**
   * Walks the cause chain (OkHttp often wraps the root cause) and returns the
   * first recognizable code. The outermost match wins so that, for example,
   * a timeout wrapping a socket error is still reported as TIMEOUT.
   */
  fun codeFor(error: Throwable): String {
    var current: Throwable? = error
    var depth = 0
    while (current != null && depth < MAX_CAUSE_DEPTH) {
      directCode(current)?.let { return it }
      current = current.cause
      depth++
    }
    return UNKNOWN
  }

  private fun directCode(error: Throwable): String? = when (error) {
    is UnknownHostException -> DNS_FAILURE
    // SocketTimeoutException extends InterruptedIOException; check it first
    // for clarity. OkHttp's callTimeout throws InterruptedIOException("timeout").
    is SocketTimeoutException -> TIMEOUT
    is InterruptedIOException -> TIMEOUT
    is SSLException -> TLS_FAILURE
    is CertificateException -> TLS_FAILURE
    is ConnectException -> CONNECTION_FAILURE
    is NoRouteToHostException -> CONNECTION_FAILURE
    is PortUnreachableException -> CONNECTION_FAILURE
    is SocketException -> CONNECTION_FAILURE
    is IllegalArgumentException -> INVALID_ENDPOINT
    else -> null
  }

  /** A short message safe to show to developers. Never includes headers or bodies. */
  fun messageFor(error: Throwable): String {
    val name = error.javaClass.simpleName.ifEmpty { "Exception" }
    val message = error.message?.take(300)
    return if (message.isNullOrBlank()) name else "$name: $message"
  }
}
