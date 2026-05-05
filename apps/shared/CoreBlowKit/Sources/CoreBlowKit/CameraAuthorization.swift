import AVFoundation
public enum CameraAuthorization {
    public static var isGranted: Bool { AVCaptureDevice.authorizationStatus(for: .video) == .authorized }
    public static func request() async -> Bool { await AVCaptureDevice.requestAccess(for: .video) }
}
