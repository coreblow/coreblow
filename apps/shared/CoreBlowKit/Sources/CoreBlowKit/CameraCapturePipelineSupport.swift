import AVFoundation; import Foundation
public enum CameraCapturePipelineSupport {
    public static func bestDevice(position: AVCaptureDevice.Position = .unspecified) -> AVCaptureDevice? { AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) }
}
