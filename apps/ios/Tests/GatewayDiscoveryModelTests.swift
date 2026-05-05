import Testing
@testable import CoreBlow

@Suite("GatewayDiscoveryModel")
struct GatewayDiscoveryModelTests {
    @Test @MainActor func initialStateIsNotScanning() {
        let model = GatewayDiscoveryModel()
        #expect(!model.isScanning)
        #expect(model.discoveredEndpoints.isEmpty)
    }

    @Test @MainActor func startScanTogglesState() {
        let model = GatewayDiscoveryModel()
        model.startScan()
        #expect(model.isScanning)
    }
}
