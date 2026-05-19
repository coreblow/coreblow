public struct CoreBarStatus: Equatable, Sendable {
  public enum ServiceState: String, Sendable {
    case stopped
    case starting
    case running
    case degraded
  }

  public let state: ServiceState
  public let activeConnections: Int

  public init(state: ServiceState, activeConnections: Int) {
    self.state = state
    self.activeConnections = max(0, activeConnections)
  }

  public var canOpenDashboard: Bool {
    state == .running || state == .degraded
  }
}
