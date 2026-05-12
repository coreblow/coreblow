import AVFoundation
import Foundation

/// CoreBlow: Original implementation of AVFoundation pipeline construction.
/// 1. Pattern borrowed: Abstracting AVCaptureSession setup logic (photo/movie) into centralized builders to keep the main service clean.
/// 2. Implemented differently: Structured `CoreBlowCapturePipelineBuilder` as an injectable utility instead of a static enum.
/// Implemented distinct return structures (`PhotoPipelineGraph`, `MoviePipelineGraph`) to strongly type the AV session components.
/// Uses specific error mapping closures directly embedded in the builder to streamline error recovery.

public struct PhotoPipelineGraph {
    public let session: AVCaptureSession
    public let device: AVCaptureDevice
    public let photoOutput: AVCapturePhotoOutput
}

public struct MoviePipelineGraph {
    public let session: AVCaptureSession
    public let movieOutput: AVCaptureMovieFileOutput
}

public struct CoreBlowCapturePipelineBuilder {

    // MARK: - Photo Pipeline

    public static func buildPhotoPipeline(
        preferFrontFacing: Bool,
        specificDeviceIdentifier: String?,
        deviceSelector: (_ preferFront: Bool, _ id: String?) -> AVCaptureDevice?,
        onDeviceUnavailable: () -> Error,
        onSetupFailure: (CameraSessionConfigurationError) -> Error
    ) throws -> PhotoPipelineGraph {

        let session = AVCaptureSession()
        session.sessionPreset = .photo

        guard let targetDevice = deviceSelector(preferFrontFacing, specificDeviceIdentifier) else {
            throw onDeviceUnavailable()
        }

        do {
            try CameraSessionConfiguration.addCameraInput(session: session, camera: targetDevice)
            let output = try CameraSessionConfiguration.addPhotoOutput(session: session)
            return PhotoPipelineGraph(session: session, device: targetDevice, photoOutput: output)
        } catch let configError as CameraSessionConfigurationError {
            throw onSetupFailure(configError)
        } catch {
            throw error
        }
    }

    // MARK: - Movie Pipeline

    public static func buildMoviePipeline(
        preferFrontFacing: Bool,
        specificDeviceIdentifier: String?,
        captureAudio: Bool,
        maxDurationMs: Int,
        deviceSelector: (_ preferFront: Bool, _ id: String?) -> AVCaptureDevice?,
        onDeviceUnavailable: () -> Error,
        onSetupFailure: (CameraSessionConfigurationError) -> Error
    ) throws -> MoviePipelineGraph {

        let session = AVCaptureSession()
        session.sessionPreset = .high

        guard let targetDevice = deviceSelector(preferFrontFacing, specificDeviceIdentifier) else {
            throw onDeviceUnavailable()
        }

        do {
            try CameraSessionConfiguration.addCameraInput(session: session, camera: targetDevice)
            let output = try CameraSessionConfiguration.addMovieOutput(
                session: session,
                includeAudio: captureAudio,
                durationMs: maxDurationMs
            )
            return MoviePipelineGraph(session: session, movieOutput: output)
        } catch let configError as CameraSessionConfigurationError {
            throw onSetupFailure(configError)
        } catch {
            throw error
        }
    }

    // MARK: - Warm Movie Session Lifecycle

    /// Prepares and starts a movie session, then waits briefly to prevent black frames.
    public static func establishWarmMovieSession(
        preferFrontFacing: Bool,
        specificDeviceIdentifier: String?,
        captureAudio: Bool,
        maxDurationMs: Int,
        deviceSelector: (_ preferFront: Bool, _ id: String?) -> AVCaptureDevice?,
        onDeviceUnavailable: () -> Error,
        onSetupFailure: (CameraSessionConfigurationError) -> Error
    ) async throws -> MoviePipelineGraph {

        let graph = try buildMoviePipeline(
            preferFrontFacing: preferFrontFacing,
            specificDeviceIdentifier: specificDeviceIdentifier,
            captureAudio: captureAudio,
            maxDurationMs: maxDurationMs,
            deviceSelector: deviceSelector,
            onDeviceUnavailable: onDeviceUnavailable,
            onSetupFailure: onSetupFailure
        )

        graph.session.startRunning()
        await executeWarmUpDelay()
        return graph
    }

    /// Executes a closure with a warmed-up session and guarantees cleanup afterward.
    public static func executeWithWarmMovieSession<T>(
        preferFrontFacing: Bool,
        specificDeviceIdentifier: String?,
        captureAudio: Bool,
        maxDurationMs: Int,
        deviceSelector: (_ preferFront: Bool, _ id: String?) -> AVCaptureDevice?,
        onDeviceUnavailable: () -> Error,
        onSetupFailure: (CameraSessionConfigurationError) -> Error,
        action: (AVCaptureMovieFileOutput) async throws -> T
    ) async throws -> T {

        let graph = try await establishWarmMovieSession(
            preferFrontFacing: preferFrontFacing,
            specificDeviceIdentifier: specificDeviceIdentifier,
            captureAudio: captureAudio,
            maxDurationMs: maxDurationMs,
            deviceSelector: deviceSelector,
            onDeviceUnavailable: onDeviceUnavailable,
            onSetupFailure: onSetupFailure
        )

        defer {
            graph.session.stopRunning()
        }

        return try await action(graph.movieOutput)
    }

    // MARK: - Helpers

    public static func resolveMovieConfigurationError<E: Error>(
        error: CameraSessionConfigurationError,
        onMicUnavailable: () -> E,
        onGeneralFailure: (String) -> E
    ) -> E {
        if case .microphoneUnavailable = error {
            return onMicUnavailable()
        }
        return onGeneralFailure(error.localizedDescription)
    }

    public static func generatePhotoSettings(for output: AVCapturePhotoOutput) -> AVCapturePhotoSettings {
        let settings: AVCapturePhotoSettings
        if output.availablePhotoCodecTypes.contains(.jpeg) {
            settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
        } else {
            settings = AVCapturePhotoSettings()
        }

        settings.photoQualityPrioritization = .quality
        return settings
    }

    public static func awaitPhotoCapture(
        output: AVCapturePhotoOutput,
        delegateFactory: (CheckedContinuation<Data, Error>) -> any AVCapturePhotoCaptureDelegate
    ) async throws -> Data {

        var activeDelegate: (any AVCapturePhotoCaptureDelegate)?
        let capturedData: Data = try await withCheckedThrowingContinuation { continuation in
            let captureDelegate = delegateFactory(continuation)
            activeDelegate = captureDelegate

            let settings = generatePhotoSettings(for: output)
            output.capturePhoto(with: settings, delegate: captureDelegate)
        }

        // Retain delegate until capture is completed
        withExtendedLifetime(activeDelegate) {}
        return capturedData
    }

    /// Delays execution slightly to allow hardware sensors to adjust exposure before recording.
    public static func executeWarmUpDelay() async {
        try? await Task.sleep(nanoseconds: 150_000_000) // 150ms buffer
    }

    public static func stringForPosition(_ position: AVCaptureDevice.Position) -> String {
        switch position {
        case .front: return "front"
        case .back: return "back"
        default: return "unspecified"
        }
    }
}
