import Testing
@testable import CoreBlow

@Suite("CameraControllerClamp")
struct CameraControllerClampTests {
    @Test func clampQualityDefaultsToNinetyPercent() {
        let q = CameraController.clampQuality(nil)
        #expect(q == 0.9)
    }

    @Test func clampQualityFloorIsFivePercent() {
        #expect(CameraController.clampQuality(0.01) == 0.05)
        #expect(CameraController.clampQuality(-1.0) == 0.05)
    }

    @Test func clampQualityCeilingIsOneHundredPercent() {
        #expect(CameraController.clampQuality(2.0) == 1.0)
    }

    @Test func clampDurationMsDefault() {
        #expect(CameraController.clampDurationMs(nil) == 3000)
    }

    @Test func clampDurationMsBounds() {
        #expect(CameraController.clampDurationMs(100) == 250)
        #expect(CameraController.clampDurationMs(999999) == 60000)
    }
}
