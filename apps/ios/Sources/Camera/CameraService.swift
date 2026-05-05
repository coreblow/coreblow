import AVFoundation
import Foundation
import os

/// Handles photo and video capture for gateway invoke commands.
///
/// Pattern: actor for thread-safe camera access (mirrors OC's CameraController).
actor CameraService {

    // MARK: - Types

    struct DeviceInfo: Codable, Sendable {
        let id: String
        let name: String
        let facing: String
        let type: String
    }

    enum CaptureError: LocalizedError, Sendable {
        case deviceNotFound
        case permissionRequired(String)
        case captureFailed(String)
        case transcodeError(String)

        var errorDescription: String? {
            switch self {
            case .deviceNotFound: return "No camera device available"
            case .permissionRequired(let kind): return "\(kind) permission not granted"
            case .captureFailed(let detail): return "Capture failed: \(detail)"
            case .transcodeError(let detail): return "Transcode error: \(detail)"
            }
        }
    }

    struct PhotoResult: Sendable {
        let imageData: Data
        let format: String
        let widthPx: Int
        let heightPx: Int
    }

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "Camera")

    // MARK: - Photo Capture

    func capturePhoto(
        preferFront: Bool = true,
        maxWidthPx: Int = 1600,
        quality: Double = 0.85,
        delayMs: Int = 0
    ) async throws -> PhotoResult {
        try await verifyAccess(for: .video)

        guard let device = pickDevice(preferFront: preferFront) else {
            throw CaptureError.deviceNotFound
        }

        let session = AVCaptureSession()
        let input = try AVCaptureDeviceInput(device: device)
        let output = AVCapturePhotoOutput()

        guard session.canAddInput(input), session.canAddOutput(output) else {
            throw CaptureError.captureFailed("Cannot configure capture session")
        }

        session.addInput(input)
        session.addOutput(output)
        session.startRunning()
        defer { session.stopRunning() }

        // Warm-up
        try await Task.sleep(nanoseconds: 300_000_000)

        if delayMs > 0 {
            let clampedDelay = min(delayMs, 10_000)
            try await Task.sleep(nanoseconds: UInt64(clampedDelay) * 1_000_000)
        }

        let rawData = try await capturePhotoData(output: output)
        logger.info("Photo captured: \(rawData.count) bytes")

        return PhotoResult(
            imageData: rawData,
            format: "jpeg",
            widthPx: maxWidthPx,
            heightPx: 0
        )
    }

    // MARK: - Device Discovery

    func availableDevices() -> [DeviceInfo] {
        let deviceTypes: [AVCaptureDevice.DeviceType] = [
            .builtInWideAngleCamera,
            .builtInUltraWideCamera,
            .builtInTelephotoCamera,
        ]

        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: deviceTypes,
            mediaType: .video,
            position: .unspecified
        )

        return discovery.devices.map { dev in
            DeviceInfo(
                id: dev.uniqueID,
                name: dev.localizedName,
                facing: facingLabel(dev.position),
                type: dev.deviceType.rawValue
            )
        }
    }

    // MARK: - Quality Clamping

    nonisolated static func clampQuality(_ raw: Double?) -> Double {
        let q = raw ?? 0.85
        return min(1.0, max(0.05, q))
    }

    nonisolated static func clampDurationMs(_ raw: Int?) -> Int {
        let ms = raw ?? 3000
        return min(60_000, max(250, ms))
    }

    // MARK: - Private

    private func verifyAccess(for mediaType: AVMediaType) async throws {
        let status = AVCaptureDevice.authorizationStatus(for: mediaType)
        switch status {
        case .authorized:
            return
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: mediaType)
            if !granted {
                throw CaptureError.permissionRequired(mediaType == .video ? "Camera" : "Microphone")
            }
        default:
            throw CaptureError.permissionRequired(mediaType == .video ? "Camera" : "Microphone")
        }
    }

    private func pickDevice(preferFront: Bool, deviceId: String? = nil) -> AVCaptureDevice? {
        if let id = deviceId, !id.isEmpty {
            return AVCaptureDevice(uniqueID: id)
        }
        let position: AVCaptureDevice.Position = preferFront ? .front : .back
        return AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
            ?? AVCaptureDevice.default(for: .video)
    }

    private func capturePhotoData(output: AVCapturePhotoOutput) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            let settings = AVCapturePhotoSettings()
            let delegate = PhotoDelegate(continuation: continuation)
            output.capturePhoto(with: settings, delegate: delegate)
            // Keep delegate alive
            withExtendedLifetime(delegate) {}
        }
    }

    private func facingLabel(_ position: AVCaptureDevice.Position) -> String {
        switch position {
        case .front: return "front"
        case .back: return "back"
        default: return "unspecified"
        }
    }
}

// MARK: - Photo Delegate

private final class PhotoDelegate: NSObject, AVCapturePhotoCaptureDelegate, @unchecked Sendable {
    private let continuation: CheckedContinuation<Data, Error>
    private let lock = NSLock()
    private var resumed = false

    init(continuation: CheckedContinuation<Data, Error>) {
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
                domain: "ai.coreblow.camera",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Empty photo data"]
            ))
            return
        }
        continuation.resume(returning: data)
    }
}
