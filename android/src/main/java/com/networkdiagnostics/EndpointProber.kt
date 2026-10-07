package com.networkdiagnostics

import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.Call
import okhttp3.Callback
import okhttp3.ConnectionPool
import okhttp3.EventListener
import okhttp3.Handshake
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response

/** Outcome of one probe. Null fields are omitted when sent to JS. */
data class ProbeOutcome(
  val responded: Boolean,
  val statusCode: Int? = null,
  val totalMs: Double? = null,
  val dnsMs: Double? = null,
  val tcpConnectMs: Double? = null,
  val tlsHandshakeMs: Double? = null,
  val errorCode: String? = null,
  val errorMessage: String? = null,
)

/**
 * Sends a single HTTPS request and measures it with an OkHttp EventListener.
 *
 * - Runs asynchronously on OkHttp's dispatcher threads, never on the UI thread.
 * - Uses a dedicated connection pool that keeps no idle connections, so every
 *   probe pays DNS + TCP + TLS like a cold request would.
 * - Does not follow redirects and never reads the response body.
 * - No cookies, no cache, no retries. Only the URL the app supplied is contacted.
 */
class EndpointProber(private val baseClient: OkHttpClient = OkHttpClient()) {
  fun probe(url: String, method: String, timeoutMs: Long, onResult: (ProbeOutcome) -> Unit) {
    val httpUrl = url.trim().toHttpUrlOrNull()
    if (httpUrl == null || !httpUrl.isHttps) {
      onResult(
        ProbeOutcome(
          responded = false,
          errorCode = ProbeErrorMapper.INVALID_ENDPOINT,
          errorMessage = "Endpoint must be an absolute https:// URL",
        )
      )
      return
    }
    val normalizedMethod = if (method == "GET") "GET" else "HEAD"
    val timings = ProbeTimings()
    val pool = ConnectionPool(0, 1, TimeUnit.MILLISECONDS)
    val client = baseClient.newBuilder()
      .connectionPool(pool)
      .cache(null)
      .followRedirects(false)
      .followSslRedirects(false)
      .retryOnConnectionFailure(false)
      .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .writeTimeout(timeoutMs, TimeUnit.MILLISECONDS)
      .eventListener(TimingListener(timings))
      .build()

    val request = Request.Builder()
      .url(httpUrl)
      .method(normalizedMethod, null)
      .header("Cache-Control", "no-cache")
      .build()

    val delivered = AtomicBoolean(false)
    fun deliver(outcome: ProbeOutcome) {
      if (delivered.compareAndSet(false, true)) {
        pool.evictAll()
        onResult(outcome)
      }
    }

    client.newCall(request).enqueue(object : Callback {
      override fun onResponse(call: Call, response: Response) {
        // Headers are in; the body is intentionally not read.
        val code = response.code
        response.close()
        deliver(
          ProbeOutcome(
            responded = true,
            statusCode = code,
            totalMs = timings.totalMs(),
            dnsMs = timings.dnsMs(),
            tcpConnectMs = timings.tcpConnectMs(),
            tlsHandshakeMs = timings.tlsHandshakeMs(),
          )
        )
      }

      override fun onFailure(call: Call, e: IOException) {
        deliver(
          ProbeOutcome(
            responded = false,
            errorCode = ProbeErrorMapper.codeFor(e),
            errorMessage = ProbeErrorMapper.messageFor(e),
          )
        )
      }
    })
  }

  private class TimingListener(private val t: ProbeTimings) : EventListener() {
    override fun callStart(call: Call) {
      t.callStart = System.nanoTime()
    }

    override fun dnsStart(call: Call, domainName: String) {
      t.dnsStart = System.nanoTime()
    }

    override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<InetAddress>) {
      t.dnsEnd = System.nanoTime()
    }

    override fun connectStart(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy) {
      // A failed attempt on one address followed by a retry on another
      // overwrites this, so the value reflects the successful connection.
      t.connectStart = System.nanoTime()
      t.secureConnectStart = null
      t.secureConnectEnd = null
    }

    override fun secureConnectStart(call: Call) {
      t.secureConnectStart = System.nanoTime()
    }

    override fun secureConnectEnd(call: Call, handshake: Handshake?) {
      t.secureConnectEnd = System.nanoTime()
    }

    override fun connectEnd(
      call: Call,
      inetSocketAddress: InetSocketAddress,
      proxy: Proxy,
      protocol: Protocol?
    ) {
      t.connectEnd = System.nanoTime()
    }

    override fun responseHeadersEnd(call: Call, response: Response) {
      t.responseHeadersEnd = System.nanoTime()
    }
  }
}
