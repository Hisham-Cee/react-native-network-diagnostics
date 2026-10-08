import XCTest

@testable import NetworkDiagnosticsCore

final class ProbeErrorMapperTests: XCTestCase {
  private func code(_ c: URLError.Code) -> String {
    ProbeErrorMapper.code(for: URLError(c))
  }

  func testTimeout() {
    XCTAssertEqual(code(.timedOut), "TIMEOUT")
  }

  func testDns() {
    XCTAssertEqual(code(.cannotFindHost), "DNS_FAILURE")
    XCTAssertEqual(code(.dnsLookupFailed), "DNS_FAILURE")
  }

  func testTls() {
    for c: URLError.Code in [
      .secureConnectionFailed, .serverCertificateHasBadDate, .serverCertificateUntrusted,
      .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid,
      .clientCertificateRejected, .clientCertificateRequired,
    ] {
      XCTAssertEqual(code(c), "TLS_FAILURE", "\(c)")
    }
  }

  func testConnection() {
    for c: URLError.Code in [
      .cannotConnectToHost, .networkConnectionLost, .notConnectedToInternet,
      .internationalRoamingOff, .callIsActive, .dataNotAllowed, .cannotLoadFromNetwork,
    ] {
      XCTAssertEqual(code(c), "CONNECTION_FAILURE", "\(c)")
    }
  }

  func testInvalidEndpoint() {
    XCTAssertEqual(code(.badURL), "INVALID_ENDPOINT")
    XCTAssertEqual(code(.unsupportedURL), "INVALID_ENDPOINT")
    XCTAssertEqual(code(.appTransportSecurityRequiresSecureConnection), "INVALID_ENDPOINT")
  }

  func testUnknown() {
    XCTAssertEqual(code(.cancelled), "UNKNOWN")
    XCTAssertEqual(code(.badServerResponse), "UNKNOWN")
    XCTAssertEqual(ProbeErrorMapper.code(domain: "SomeOtherDomain", code: -1001), "UNKNOWN")
    XCTAssertEqual(ProbeErrorMapper.code(domain: NSURLErrorDomain, code: 123_456), "UNKNOWN")
  }

  func testMessageIsBounded() {
    let error = NSError(
      domain: NSURLErrorDomain, code: -1001,
      userInfo: [NSLocalizedDescriptionKey: String(repeating: "x", count: 1000)])
    XCTAssertLessThan(ProbeErrorMapper.message(for: error).count, 350)
    XCTAssertTrue(ProbeErrorMapper.message(for: error).hasPrefix(NSURLErrorDomain))
  }
}
