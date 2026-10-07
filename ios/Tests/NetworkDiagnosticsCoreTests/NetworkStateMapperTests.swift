import XCTest

@testable import NetworkDiagnosticsCore

final class NetworkStateMapperTests: XCTestCase {
  private func path(
    _ status: PathSnapshot.Status = .satisfied,
    _ interfaces: Set<PathSnapshot.Interface> = [.wifi],
    expensive: Bool = false,
    constrained: Bool? = false
  ) -> PathSnapshot {
    PathSnapshot(status: status, interfaces: interfaces, isExpensive: expensive, isConstrained: constrained)
  }

  func testUnsatisfiedIsDisconnected() {
    let result = NetworkStateMapper.map(path(.unsatisfied, []))
    XCTAssertFalse(result.connected)
    XCTAssertEqual(result.type, "none")
    XCTAssertNil(result.metered)
  }

  func testRequiresConnectionIsDisconnected() {
    XCTAssertEqual(NetworkStateMapper.map(path(.requiresConnection, [.other])), NetworkStateMapper.disconnected)
  }

  func testWifi() {
    let result = NetworkStateMapper.map(path())
    XCTAssertEqual(result, NetworkStateResult(connected: true, type: "wifi", metered: false, constrained: false))
  }

  func testCellularIsExpensive() {
    let result = NetworkStateMapper.map(path(.satisfied, [.cellular], expensive: true))
    XCTAssertEqual(result.type, "cellular")
    XCTAssertEqual(result.metered, true)
  }

  func testLowDataMode() {
    let result = NetworkStateMapper.map(path(.satisfied, [.wifi], constrained: true))
    XCTAssertEqual(result.constrained, true)
  }

  func testConstrainedUnavailableIsNil() {
    XCTAssertNil(NetworkStateMapper.map(path(constrained: nil)).constrained)
  }

  func testVpnOverWifiReportsWifi() {
    XCTAssertEqual(NetworkStateMapper.map(path(.satisfied, [.wifi, .other])).type, "wifi")
  }

  func testTypePriority() {
    XCTAssertEqual(NetworkStateMapper.resolveType([.wiredEthernet, .wifi]), "ethernet")
    XCTAssertEqual(NetworkStateMapper.resolveType([.wifi, .cellular]), "wifi")
    XCTAssertEqual(NetworkStateMapper.resolveType([.cellular]), "cellular")
    XCTAssertEqual(NetworkStateMapper.resolveType([.other]), "other")
    XCTAssertEqual(NetworkStateMapper.resolveType([.loopback]), "other")
    XCTAssertEqual(NetworkStateMapper.resolveType([]), "unknown")
  }

  func testIosNeverReportsValidationCaptivePortalOrVpn() {
    let result = NetworkStateMapper.map(path())
    XCTAssertNil(result.validated)
    XCTAssertNil(result.captivePortal)
    XCTAssertNil(result.vpn)
    let dict = result.toDictionary()
    XCTAssertNil(dict["validated"])
    XCTAssertNil(dict["captivePortal"])
    XCTAssertNil(dict["vpn"])
  }

  func testDictionaryOmitsNilValues() {
    let dict = NetworkStateMapper.disconnected.toDictionary()
    XCTAssertEqual(dict["connected"] as? Bool, false)
    XCTAssertEqual(dict["type"] as? String, "none")
    XCTAssertNil(dict["metered"])
    XCTAssertNil(dict["constrained"])
  }
}
