import Foundation

/// Phase timestamps of one request, taken from
/// `URLSessionTaskTransactionMetrics`. Pure Foundation, unit tested.
public struct ProbeTimings: Equatable {
  public var fetchStart: Date?
  public var domainLookupStart: Date?
  public var domainLookupEnd: Date?
  public var connectStart: Date?
  public var secureConnectionStart: Date?
  public var secureConnectionEnd: Date?
  public var connectEnd: Date?
  public var responseStart: Date?

  public init(
    fetchStart: Date? = nil,
    domainLookupStart: Date? = nil,
    domainLookupEnd: Date? = nil,
    connectStart: Date? = nil,
    secureConnectionStart: Date? = nil,
    secureConnectionEnd: Date? = nil,
    connectEnd: Date? = nil,
    responseStart: Date? = nil
  ) {
    self.fetchStart = fetchStart
    self.domainLookupStart = domainLookupStart
    self.domainLookupEnd = domainLookupEnd
    self.connectStart = connectStart
    self.secureConnectionStart = secureConnectionStart
    self.secureConnectionEnd = secureConnectionEnd
    self.connectEnd = connectEnd
    self.responseStart = responseStart
  }

  /// Request start to first response byte (headers).
  public var totalMs: Double? { Self.durationMs(fetchStart, responseStart) }
  /// Hostname resolution, when the system reports it for this request.
  public var dnsMs: Double? { Self.durationMs(domainLookupStart, domainLookupEnd) }
  /// TCP handshake only (until TLS starts, or until connect ends without TLS).
  public var tcpConnectMs: Double? { Self.durationMs(connectStart, secureConnectionStart ?? connectEnd) }
  /// TLS handshake.
  public var tlsHandshakeMs: Double? { Self.durationMs(secureConnectionStart, secureConnectionEnd) }

  public static func durationMs(_ start: Date?, _ end: Date?) -> Double? {
    guard let start = start, let end = end else { return nil }
    let ms = end.timeIntervalSince(start) * 1000
    return ms >= 0 ? ms : nil
  }
}

/// Result of one probe, converted to a dictionary for JavaScript.
public struct ProbeOutcome: Equatable {
  public var responded: Bool
  public var statusCode: Int?
  public var timings: ProbeTimings
  /// Used when metrics are unavailable: wall-clock time to response headers.
  public var fallbackTotalMs: Double?
  public var errorCode: String?
  public var errorMessage: String?

  public init(
    responded: Bool,
    statusCode: Int? = nil,
    timings: ProbeTimings = ProbeTimings(),
    fallbackTotalMs: Double? = nil,
    errorCode: String? = nil,
    errorMessage: String? = nil
  ) {
    self.responded = responded
    self.statusCode = statusCode
    self.timings = timings
    self.fallbackTotalMs = fallbackTotalMs
    self.errorCode = errorCode
    self.errorMessage = errorMessage
  }

  public static func failure(code: String, message: String) -> ProbeOutcome {
    ProbeOutcome(responded: false, errorCode: code, errorMessage: message)
  }

  public func toDictionary() -> [String: Any] {
    var dict: [String: Any] = ["responded": responded]
    if let statusCode = statusCode { dict["statusCode"] = statusCode }
    if responded {
      if let total = timings.totalMs ?? fallbackTotalMs { dict["totalMs"] = total }
      if let dns = timings.dnsMs { dict["dnsMs"] = dns }
      if let tcp = timings.tcpConnectMs { dict["tcpConnectMs"] = tcp }
      if let tls = timings.tlsHandshakeMs { dict["tlsHandshakeMs"] = tls }
    }
    if let errorCode = errorCode { dict["errorCode"] = errorCode }
    if let errorMessage = errorMessage { dict["errorMessage"] = errorMessage }
    return dict
  }
}

/// Validates the probe URL. Only absolute https URLs with a host are accepted.
public enum EndpointValidator {
  public static func validate(_ string: String) -> URL? {
    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let components = URLComponents(string: trimmed),
      components.scheme?.lowercased() == "https",
      let host = components.host, !host.isEmpty,
      components.user == nil, components.password == nil,
      let url = components.url
    else {
      return nil
    }
    return url
  }
}

/// Thread-safe "first caller wins" flag, used to settle a promise exactly once
/// when a result and a timeout race.
public final class OnceFlag {
  private let lock = NSLock()
  private var claimed = false

  public init() {}

  /// Returns true for the first caller only.
  public func claim() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if claimed { return false }
    claimed = true
    return true
  }
}
