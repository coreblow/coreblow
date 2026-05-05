import AVFoundation
public struct CameraSessionConfiguration: Sendable { public let preset: AVCaptureSession.Preset; public let position: AVCaptureDevice.Position
    public init(preset: AVCaptureSession.Preset = .photo, position: AVCaptureDevice.Position = .unspecified) { self.preset = preset; self.position = position } }
