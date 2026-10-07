import Foundation

/// Maps URLSession errors to the normalized codes shared with Android and JS
/// (see src/errors.ts). Pure Foundation, unit tested.
public enum ProbeErrorMapper {
  public static let timeout = "TIMEOUT"
  public static let dnsFailure = "DNS_FAILURE"
  public static let connectionFailure = "CONNECTION_FAILURE"
  public static let tlsFailure = "TLS_FAILURE"
  public static let invalidEndpoint = "INVALID_ENDPOINT"
  public static let diagnosticUnavailable = "DIAGNOSTIC_UNAVAILABLE"
  public static let unknown = "UNKNOWN"

  public static func code(for error: Error) -> String {
    let nsError = error as NSError
    return code(domain: nsError.domain, code: nsError.code)
  }

  public static func code(domain: String, code: Int) -> String {
    guard domain == NSURLErrorDomain else {
      return unknown
    }
    switch URLError.Code(rawValue: code) {
    case .timedOut:
      return timeout
    case .cannotFindHost, .dnsLookupFailed:
      return dnsFailure
    case .secureConnectionFailed,
      .serverCertificateHasBadDate,
      .serverCertificateUntrusted,
      .serverCertificateHasUnknownRoot,
      .serverCertificateNotYetValid,
      .clientCertificateRejected,
      .clientCertificateRequired:
      return tlsFailure
    case .cannotConnectToHost,
      .networkConnectionLost,
      .notConnectedToInternet,
      .internationalRoamingOff,
      .callIsActive,
      .dataNotAllowed,
      .cannotLoadFromNetwork:
      return connectionFailure
    case .badURL, .unsupportedURL, .appTransportSecurityRequiresSecureConnection:
      return invalidEndpoint
    default:
      return unknown
    }
  }

  /// Short developer-facing description. Never includes headers or bodies.
  public static func message(for error: Error) -> String {
    let nsError = error as NSError
    let description = nsError.localizedDescription
    let trimmed = description.count > 300 ? String(description.prefix(300)) : description
    return "\(nsError.domain) \(nsError.code): \(trimmed)"
  }
}
