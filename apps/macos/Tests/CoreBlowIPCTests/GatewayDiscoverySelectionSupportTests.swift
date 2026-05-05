import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct GatewayDiscoverySelectionSupportTests {
    @Test func `selects local when mode is local`() {
        let result = GatewayDiscoverySelectionSupport.select(
            mode: .local,
            localURL: URL(string: "http://localhost:3000"),
            remoteURL: URL(string: "https://api.example.com"),
            tailscaleURL: nil)
        #expect(result?.absoluteString == "http://localhost:3000")
    }

    @Test func `selects remote when mode is remote`() {
        let result = GatewayDiscoverySelectionSupport.select(
            mode: .remote,
            localURL: URL(string: "http://localhost:3000"),
            remoteURL: URL(string: "https://api.example.com"),
            tailscaleURL: nil)
        #expect(result?.absoluteString == "https://api.example.com")
    }

    @Test func `prefers tailscale when available in remote mode`() {
        let result = GatewayDiscoverySelectionSupport.select(
            mode: .remote,
            localURL: nil,
            remoteURL: URL(string: "https://api.example.com"),
            tailscaleURL: URL(string: "https://tailscale.example.com"))
        #expect(result?.absoluteString == "https://tailscale.example.com")
    }

    @Test func `returns nil when no URL available`() {
        let result = GatewayDiscoverySelectionSupport.select(
            mode: .local,
            localURL: nil,
            remoteURL: nil,
            tailscaleURL: nil)
        #expect(result == nil)
    }

    @Test func `falls back to local when remote unavailable`() {
        let result = GatewayDiscoverySelectionSupport.select(
            mode: .remote,
            localURL: URL(string: "http://localhost:3000"),
            remoteURL: nil,
            tailscaleURL: nil)
        #expect(result == nil)
    }
}
