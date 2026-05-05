import AVFoundation; import Foundation
public enum CameraCommands {
    public static func capturePhoto(maxWidth: Int? = nil, quality: Double? = nil) async throws -> Data { throw NSError(domain: "Camera", code: 1, userInfo: [NSLocalizedDescriptionKey: "Camera capture not implemented on this platform"]) }
}
