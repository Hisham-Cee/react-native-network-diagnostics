import Foundation

/// Pure mapping from a path snapshot to the values exposed to JavaScript.
///
/// This file only depends on Foundation (not on the Network framework or
/// React Native) so it can be unit tested with `swift test` in `ios/`.

/// Plain-data copy of the parts of `NWPath` the library uses.
public struct PathSnapshot: Equatable {
  public enum Status: Equatable {
    case satisfied
    case unsatisfied
    case requiresConnection
  }

  public enum Interface: Equatable, Hashable {
    case wifi
    case cellular
    case wiredEthernet
    case loopback
    case other
  }

  public var status: Status
  /// Interface types the path uses (`NWPath.usesInterfaceType`).
  public var interfaces: Set<Interface>
  /// `NWPath.isExpensive`
  public var isExpensive: Bool
  /// `NWPath.isConstrained` (iOS 13+). `nil` when unavailable.
  public var isConstrained: Bool?

  public init(status: Status, interfaces: Set<Interface>, isExpensive: Bool, isConstrained: Bool?) {
    self.status = status
    self.interfaces = interfaces
    self.isExpensive = isExpensive
    self.isConstrained = isConstrained
  }
}

/// Values sent to JavaScript. `nil` fields are omitted from the dictionary.
public struct NetworkStateResult: Equatable {
  public var connected: Bool
  public var type: String
  public var metered: Bool?
  public var constrained: Bool?

  /// iOS has no public API for these. They are always omitted so that the JS
  /// side reports `undefined` instead of an invented value.
  public var vpn: Bool? { nil }
  public var validated: Bool? { nil }
  public var captivePortal: Bool? { nil }

  public func toDictionary() -> [String: Any] {
    var dict: [String: Any] = ["connected": connected, "type": type]
    if let metered = metered { dict["metered"] = metered }
    if let constrained = constrained { dict["constrained"] = constrained }
    return dict
  }
}

public enum NetworkStateMapper {
  public static let disconnected = NetworkStateResult(
    connected: false, type: "none", metered: nil, constrained: nil)

  public static func map(_ path: PathSnapshot) -> NetworkStateResult {
    // `.requiresConnection` (for example an on-demand VPN that is not up yet)
    // cannot carry traffic right now.
    guard path.status == .satisfied else {
      return disconnected
    }
    return NetworkStateResult(
      connected: true,
      type: resolveType(path.interfaces),
      metered: path.isExpensive,
      constrained: path.isConstrained
    )
  }

  /// Physical transport priority: ethernet, Wi-Fi, cellular, then other.
  /// A VPN appears as an `.other` (utun/ipsec) interface on iOS, so it never
  /// hides the underlying transport and is not reported as "vpn".
  public static func resolveType(_ interfaces: Set<PathSnapshot.Interface>) -> String {
    if interfaces.contains(.wiredEthernet) { return "ethernet" }
    if interfaces.contains(.wifi) { return "wifi" }
    if interfaces.contains(.cellular) { return "cellular" }
    if interfaces.contains(.other) || interfaces.contains(.loopback) { return "other" }
    return "unknown"
  }
}
