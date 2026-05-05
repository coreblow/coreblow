import Testing
@testable import CoreBlow

@Suite("CameraControllerError")
struct CameraControllerErrorTests {
    @Test func errorDescriptionsAreNotEmpty() {
        let errors: [CameraController.CameraError] = [
            .cameraUnavailable,
            .microphoneUnavailable,
            .permissionDenied(kind: "Camera"),
            .captureFailed("test"),
            .exportFailed("test"),
        ]
        for error in errors {
            #expect(error.errorDescription != nil)
            #expect(!error.errorDescription!.isEmpty)
        }
    }
}
