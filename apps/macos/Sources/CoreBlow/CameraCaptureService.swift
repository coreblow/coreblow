import AVFoundation; import Foundation
actor CameraCaptureService {
    func capturePhoto(facing: CameraFacing, maxWidth: Int?, quality: Double?) async throws -> Data { throw NSError(domain: "Camera", code: 1, userInfo: [NSLocalizedDescriptionKey: "Not implemented"]) }
    func captureClip(facing: CameraFacing, durationMs: Int?, includeAudio: Bool) async throws -> Data { throw NSError(domain: "Camera", code: 2, userInfo: [NSLocalizedDescriptionKey: "Not implemented"]) }
}
