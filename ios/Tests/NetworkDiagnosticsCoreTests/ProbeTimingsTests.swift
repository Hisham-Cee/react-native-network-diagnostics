import XCTest

@testable import NetworkDiagnosticsCore

final class ProbeTimingsTests: XCTestCase {
  private let t0 = Date(timeIntervalSince1970: 1_000_000)

  private func at(_ ms: Double) -> Date {
    t0.addingTimeInterval(ms / 1000)
  }

  func testFullHttpsTimeline() {
    let timings = ProbeTimings(
      fetchStart: at(0),
      domainLookupStart: at(1),
      domainLookupEnd: at(6),
      connectStart: at(6),
      secureConnectionStart: at(26),
      secureConnectionEnd: at(61),
      connectEnd: at(61),
      responseStart: at(82)
    )
    XCTAssertEqual(timings.totalMs!, 82, accuracy: 0.01)
    XCTAssertEqual(timings.dnsMs!, 5, accuracy: 0.01)
    XCTAssertEqual(timings.tcpConnectMs!, 20, accuracy: 0.01)
    XCTAssertEqual(timings.tlsHandshakeMs!, 35, accuracy: 0.01)
  }

  func testReusedConnectionHasNoPhases() {
    let timings = ProbeTimings(fetchStart: at(0), responseStart: at(30))
    XCTAssertEqual(timings.totalMs!, 30, accuracy: 0.01)
    XCTAssertNil(timings.dnsMs)
    XCTAssertNil(timings.tcpConnectMs)
    XCTAssertNil(timings.tlsHandshakeMs)
  }

  func testNegativeDurationIsNil() {
    XCTAssertNil(ProbeTimings.durationMs(at(10), at(5)))
    XCTAssertNil(ProbeTimings.durationMs(nil, at(5)))
  }

  func testOutcomeDictionaryUsesFallbackTotal() {
    let outcome = ProbeOutcome(responded: true, statusCode: 204, fallbackTotalMs: 42)
    let dict = outcome.toDictionary()
    XCTAssertEqual(dict["responded"] as? Bool, true)
    XCTAssertEqual(dict["statusCode"] as? Int, 204)
    XCTAssertEqual(dict["totalMs"] as? Double, 42)
    XCTAssertNil(dict["dnsMs"])
    XCTAssertNil(dict["errorCode"])
  }

  func testFailureDictionary() {
    let dict = ProbeOutcome.failure(code: "DNS_FAILURE", message: "m").toDictionary()
    XCTAssertEqual(dict["responded"] as? Bool, false)
    XCTAssertEqual(dict["errorCode"] as? String, "DNS_FAILURE")
    XCTAssertEqual(dict["errorMessage"] as? String, "m")
    XCTAssertNil(dict["totalMs"])
  }
}

final class EndpointValidatorTests: XCTestCase {
  func testAcceptsHttps() {
    XCTAssertNotNil(EndpointValidator.validate("https://api.example.com/health"))
    XCTAssertNotNil(EndpointValidator.validate("  HTTPS://api.example.com:8443/x?y=1 "))
  }

  func testRejectsOthers() {
    XCTAssertNil(EndpointValidator.validate("http://api.example.com"))
    XCTAssertNil(EndpointValidator.validate("api.example.com"))
    XCTAssertNil(EndpointValidator.validate("https://"))
    XCTAssertNil(EndpointValidator.validate("https://user:pass@example.com"))
    XCTAssertNil(EndpointValidator.validate(""))
  }
}
