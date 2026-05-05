import AVFoundation
import Foundation
import os

/// Handles photo and video capture for gateway invoke commands.
actor CameraController {

    struct CameraDeviceInfo: Codable, Sendable {
        var id: String
        var name: String
        var position: String
        var deviceType: String
    }

    enum CameraError: LocalizedError, Sendable {
        case cameraUnavailable
        case microphoneUnavailable
        case permissionDenied(kind: String)
        case invalidParams(String)
        case captureFailed(String)
        case exportFailed(String)

        var errorDescription: String? {
            switch self {
            case .cameraUnavailable: "Camera unavailable"
            case .microphoneUnavailable: "Microphone unavailable"
            case let .permissionDenied(kind): "\(kind) permission denied"
            case let .invalidParams(msg): msg
            case let .captureFailed(msg): msg
            case let .exportFailed(msg): msg
            }
        }
    }

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "CameraController")

    func snap(
        preferFront: Bool = true,
        maxWidth: Int = 1600,
        quality: Double = 0.9,
        delayMs: Int = 0
    ) async throws -> (format: String, base64: String, width: Int, height: Int) {
        let clampedQuality = Self.clampQuality(quality)
        let clampedDelay = max(0, delayMs)

        try await ensureAccess(for: .video)

        guard let device = Self.pickCamera(preferFront: preferFront) else {
            throw CameraError.cameraUnavailable
        }

        let session = AVCaptureSession()
        let input = try AVCaptureDeviceInput(device: device)
        let output = AVCapturePhotoOutput()

        guard session.canAddInput(input), session.canAddOutput(output) else {
            throw CameraError.captureFailed("Cannot configure session")
        }

        session.addInput(input)
        session.addOutput(output)
        session.startRunning()
        defer { session.stopRunning() }

        // Warm-up for auto-exposure
        try await Task.sleep(nanoseconds: 300_000_000)
        await Self.sleepDelayMs(clampedDelay)

        let rawData = try await capturePhotoData(output: output)

        return (
            format: "jpg",
            base64: rawData.base64EncodedString(),
            width: maxWidth,
            height: 0)
    }

    func listDevices() -> [CameraDeviceInfo] {
        Self.discoverVideoDevices().map { device in
            CameraDeviceInfo(
                id: device.uniqueID,
                name: device.localizedName,
                position: Self.positionLabel(device.position),
                deviceType: device.deviceType.rawValue)
        }
    }

    private func ensureAccess(for mediaType: AVMediaType) async throws {
        let status = AVCaptureDevice.authorizationStatus(for: mediaType)
        switch status {
        case .authorized: return
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: mediaType)
            if !granted { throw CameraError.permissionDenied(kind: mediaType == .video ? "Camera" : "Microphone") }
        default:
            throw CameraError.permissionDenied(kind: mediaType == .video ? "Camera" : "Microphone")
        }
    }

    private nonisolated static func pickCamera(
        preferFront: Bool,
        deviceId: String? = nil
    ) -> AVCaptureDevice? {
        if let deviceId, !deviceId.isEmpty {
            if let match = discoverVideoDevices().first(where: { $0.uniqueID == deviceId }) {
                return match
            }
        }
        let position: AVCaptureDevice.Position = preferFront ? .front : .back
        if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) {
            return device
        }
        return AVCaptureDevice.default(for: .video)
    }

    private nonisolated static func discoverVideoDevices() -> [AVCaptureDevice] {
        let types: [AVCaptureDevice.DeviceType] = [
            .builtInWideAngleCamera,
            .builtInUltraWideCamera,
            .builtInTelephotoCamera,
        ]
        return AVCaptureDevice.DiscoverySession(
            deviceTypes: types,
            mediaType: .video,
            position: .unspecified
        ).devices
    }

    private nonisolated static func positionLabel(_ position: AVCaptureDevice.Position) -> String {
        switch position {
        case .front: "front"
        case .back: "back"
        default: "unspecified"
        }
    }

    nonisolated static func clampQuality(_ quality: Double?) -> Double {
        let q = quality ?? 0.9
        return min(1.0, max(0.05, q))
    }

    nonisolated static func clampDurationMs(_ ms: Int?) -> Int {
        let v = ms ?? 3000
        return min(60000, max(250, v))
    }

    private func capturePhotoData(output: AVCapturePhotoOutput) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            let settings = AVCapturePhotoSettings()
            let delegate = PhotoCaptureDelegate(continuation)
            output.capturePhoto(with: settings, delegate: delegate)
            withExtendedLifetime(delegate) {}
        }
    }

    private nonisolated static func sleepDelayMs(_ delayMs: Int) async {
        guard delayMs > 0 else { return }
        let maxMs = 10_000
        let ns = UInt64(min(delayMs, maxMs)) * UInt64(NSEC_PER_MSEC)
        try? await Task.sleep(nanoseconds: ns)
    }
}

private final class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let continuation: CheckedContinuation<Data, Error>
    private let lock = NSLock()
    private var resumed = false

    init(_ continuation: CheckedContinuation<Data, Error>) {
        self.continuation = continuation
    }

    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        lock.lock()
        guard !resumed else { lock.unlock(); return }
        resumed = true
        lock.unlock()

        if let error {
            continuation.resume(throwing: error)
            return
        }
        guard let data = photo.fileDataRepresentation(), !data.isEmpty else {
            continuation.resume(throwing: NSError(
                domain: "Camera", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "photo data missing"]))
            return
        }
        continuation.resume(returning: data)
    }
}
