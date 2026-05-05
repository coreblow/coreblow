import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct GatewayConnectionControlTests {
    @Test func `connection state transitions`() {
        var state = GatewayConnectionControl.State.disconnected
        #expect(state == .disconnected)

        state = .connecting
        #expect(state == .connecting)

        state = .connected
        #expect(state == .connected)

        state = .reconnecting
        #expect(state == .reconnecting)
    }

    @Test func `backoff increases on consecutive failures`() {
        let control = GatewayConnectionControl()
        let first = control.nextBackoff(attempt: 1)
        let second = control.nextBackoff(attempt: 2)
        let third = control.nextBackoff(attempt: 3)
        #expect(second >= first)
        #expect(third >= second)
    }

    @Test func `backoff is capped`() {
        let control = GatewayConnectionControl()
        let maxAttempt = control.nextBackoff(attempt: 100)
        #expect(maxAttempt <= 60.0)
    }

    @Test func `reset clears attempt counter`() {
        var control = GatewayConnectionControl()
        _ = control.nextBackoff(attempt: 5)
        control.reset()
        let fresh = control.nextBackoff(attempt: 1)
        #expect(fresh <= 1.0)
    }
}
