import Testing
@testable import CoreBar

@Test func runningStatusCanOpenDashboard() {
  let status = CoreBarStatus(state: .running, activeConnections: 2)
  #expect(status.canOpenDashboard)
}

@Test func connectionCountIsNeverNegative() {
  let status = CoreBarStatus(state: .stopped, activeConnections: -5)
  #expect(status.activeConnections == 0)
}
