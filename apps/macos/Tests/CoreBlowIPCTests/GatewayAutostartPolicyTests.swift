import Testing
@testable import CoreBlow

struct GatewayAutostartPolicyTests {
    @Test func `autostart enabled by default`() {
        let policy = GatewayAutostartPolicy()
        #expect(policy.shouldAutostart)
    }

    @Test func `autostart disabled when opted out`() {
        let policy = GatewayAutostartPolicy(optOut: true)
        #expect(!policy.shouldAutostart)
    }

    @Test func `autostart respects remote mode`() {
        let policy = GatewayAutostartPolicy(mode: .remote)
        #expect(!policy.shouldAutostart)
    }

    @Test func `autostart allowed in local mode`() {
        let policy = GatewayAutostartPolicy(mode: .local)
        #expect(policy.shouldAutostart)
    }
}
