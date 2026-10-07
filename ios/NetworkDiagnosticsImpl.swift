import Foundation
import Network

/// Swift implementation behind the Objective-C++ TurboModule
/// (`NetworkDiagnostics.mm`). The `.mm` file conforms to the Codegen
/// protocol and forwards every call here.
///
/// Threading: all work happens on private dispatch queues or URLSession's
/// delegate queue. Completion handlers may be called on any thread; React
/// Native's promise blocks and event emitter are thread-safe.
@objc(NetworkDiagnosticsImpl)
public final class NetworkDiagnosticsImpl: NSObject {
  private static let stateTimeout: TimeInterval = 2

  private let queue = DispatchQueue(label: "networkdiagnostics.monitor")
  private var monitor: NWPathMonitor?
  private var lastEmitted: NetworkStateResult?

  // MARK: - Network state

  /// Reads the current path once. NWPathMonitor delivers the current path
  /// immediately after `start`, so this normally completes in milliseconds.
  @objc
  public func getNetworkState(
    _ resolve: @escaping ([String: Any]) -> Void,
    reject: @escaping (String, String) -> Void
  ) {
    let oneShot = NWPathMonitor()
    let stateQueue = DispatchQueue(label: "networkdiagnostics.state")
    var finished = false

    oneShot.pathUpdateHandler = { path in
      // Runs on stateQueue.
      guard !finished else { return }
      finished = true
      oneShot.cancel()
      resolve(NetworkStateMapper.map(Self.snapshot(of: path)).toDictionary())
    }
    oneShot.start(queue: stateQueue)

    stateQueue.asyncAfter(deadline: .now() + Self.stateTimeout) {
      guard !finished else { return }
      finished = true
      oneShot.cancel()
      reject(ProbeErrorMapper.diagnosticUnavailable, "NWPathMonitor did not report a path")
    }
  }

  // MARK: - Monitoring

  @objc
  public func startMonitoring(_ onChange: @escaping ([String: Any]) -> Void) {
    queue.async {
      guard self.monitor == nil else { return }
      // NWPathMonitor cannot be restarted after cancel, so create a new one.
      let monitor = NWPathMonitor()
      monitor.pathUpdateHandler = { [weak self] path in
        guard let self = self else { return }
        let state = NetworkStateMapper.map(Self.snapshot(of: path))
        // The same path is often reported several times; forward real changes only.
        guard state != self.lastEmitted else { return }
        self.lastEmitted = state
        onChange(state.toDictionary())
      }
      self.monitor = monitor
      monitor.start(queue: self.queue)
    }
  }

  @objc
  public func stopMonitoring() {
    queue.async {
      self.monitor?.cancel()
      self.monitor = nil
      self.lastEmitted = nil
    }
  }

  // MARK: - Endpoint probe

  @objc
  public func probe(
    _ urlString: String,
    method: String,
    timeoutMs: Double,
    resolve: @escaping ([String: Any]) -> Void
  ) {
    guard let url = EndpointValidator.validate(urlString) else {
      resolve(
        ProbeOutcome.failure(
          code: ProbeErrorMapper.invalidEndpoint,
          message: "Endpoint must be an absolute https:// URL"
        ).toDictionary())
      return
    }
    let timeout = min(max(timeoutMs, 500), 60_000) / 1000

    // Ephemeral session per probe: no cache, no cookies, no credential
    // storage, and no connection reuse, so every probe includes DNS, TCP and
    // TLS like a cold request.
    let config = URLSessionConfiguration.ephemeral
    config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
    config.urlCache = nil
    config.httpCookieStorage = nil
    config.httpShouldSetCookies = false
    config.urlCredentialStorage = nil
    config.timeoutIntervalForRequest = timeout
    config.timeoutIntervalForResource = timeout
    config.waitsForConnectivity = false

    var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: timeout)
    request.httpMethod = method == "GET" ? "GET" : "HEAD"
    request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

    let delegate = ProbeDelegate(onFinish: resolve)
    let delegateQueue = OperationQueue()
    delegateQueue.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: delegateQueue)
    let task = session.dataTask(with: request)
    delegate.start(task: task, session: session)
  }

  // MARK: - Helpers

  static func snapshot(of path: NWPath) -> PathSnapshot {
    let status: PathSnapshot.Status
    switch path.status {
    case .satisfied: status = .satisfied
    case .requiresConnection: status = .requiresConnection
    case .unsatisfied: status = .unsatisfied
    @unknown default: status = .unsatisfied
    }

    var interfaces = Set<PathSnapshot.Interface>()
    if path.usesInterfaceType(.wifi) { interfaces.insert(.wifi) }
    if path.usesInterfaceType(.cellular) { interfaces.insert(.cellular) }
    if path.usesInterfaceType(.wiredEthernet) { interfaces.insert(.wiredEthernet) }
    if path.usesInterfaceType(.loopback) { interfaces.insert(.loopback) }
    if path.usesInterfaceType(.other) { interfaces.insert(.other) }

    var constrained: Bool?
    if #available(iOS 13.0, *) {
      constrained = path.isConstrained
    }
    return PathSnapshot(
      status: status,
      interfaces: interfaces,
      isExpensive: path.isExpensive,
      isConstrained: constrained
    )
  }
}

/// URLSession delegate for one probe. Records the status code as soon as the
/// response headers arrive, cancels the body download, and resolves once
/// with metrics. Invalidates its session to break the session/delegate
/// retain cycle.
private final class ProbeDelegate: NSObject, URLSessionDataDelegate {
  private let onFinish: ([String: Any]) -> Void
  private let lock = NSLock()
  private var finished = false
  private var statusCode: Int?
  private var startedAt: Date?
  private var headersAt: Date?
  private var timings = ProbeTimings()
  private weak var session: URLSession?

  init(onFinish: @escaping ([String: Any]) -> Void) {
    self.onFinish = onFinish
  }

  func start(task: URLSessionDataTask, session: URLSession) {
    self.session = session
    startedAt = Date()
    task.resume()
  }

  // Do not follow redirects: a 3xx is a valid response and, on public Wi-Fi,
  // a common sign of a captive portal.
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    headersAt = Date()
    statusCode = (response as? HTTPURLResponse)?.statusCode
    // The body is never needed.
    completionHandler(.cancel)
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didFinishCollecting metrics: URLSessionTaskMetrics
  ) {
    // Use the last transaction that actually went to the network.
    guard
      let tx = metrics.transactionMetrics.last(where: { $0.resourceFetchType == .networkLoad })
        ?? metrics.transactionMetrics.last
    else { return }
    timings = ProbeTimings(
      fetchStart: tx.fetchStartDate,
      domainLookupStart: tx.domainLookupStartDate,
      domainLookupEnd: tx.domainLookupEndDate,
      connectStart: tx.connectStartDate,
      secureConnectionStart: tx.secureConnectionStartDate,
      secureConnectionEnd: tx.secureConnectionEndDate,
      connectEnd: tx.connectEndDate,
      responseStart: tx.responseStartDate
    )
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    let outcome: ProbeOutcome
    if let statusCode = statusCode {
      // Headers arrived. The cancellation we triggered afterwards is expected.
      outcome = ProbeOutcome(
        responded: true,
        statusCode: statusCode,
        timings: timings,
        fallbackTotalMs: ProbeTimings.durationMs(startedAt, headersAt)
      )
    } else if let error = error {
      outcome = ProbeOutcome.failure(
        code: ProbeErrorMapper.code(for: error),
        message: ProbeErrorMapper.message(for: error)
      )
    } else {
      outcome = ProbeOutcome.failure(code: ProbeErrorMapper.unknown, message: "No response received")
    }
    finish(outcome)
  }

  private func finish(_ outcome: ProbeOutcome) {
    lock.lock()
    let alreadyFinished = finished
    finished = true
    lock.unlock()
    guard !alreadyFinished else { return }
    session?.finishTasksAndInvalidate()
    onFinish(outcome.toDictionary())
  }
}
