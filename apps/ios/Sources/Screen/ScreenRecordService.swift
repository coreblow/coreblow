import AVFoundation
import Foundation
#if canImport(ReplayKit)
import ReplayKit
#endif

/// Handles screen recording via ReplayKit for gateway capture commands.
final class ScreenRecordService: @unchecked Sendable {

    enum RecordError: LocalizedError {
        case notAvailable
        case alreadyRecording
        case startFailed(String)
        case stopFailed(String)

        var errorDescription: String? {
            switch self {
            case .notAvailable: return "Screen recording not available"
            case .alreadyRecording: return "Recording already in progress"
            case .startFailed(let msg): return "Start failed: \(msg)"
            case .stopFailed(let msg): return "Stop failed: \(msg)"
            }
        }
    }

    private let lock = NSLock()
    private var isRecording = false

    var recording: Bool {
        lock.lock()
        defer { lock.unlock() }
        return isRecording
    }

    func startRecording() async throws {
        lock.lock()
        guard !isRecording else {
            lock.unlock()
            throw RecordError.alreadyRecording
        }
        isRecording = true
        lock.unlock()

        #if canImport(ReplayKit)
        let recorder = RPScreenRecorder.shared()
        guard recorder.isAvailable else {
            lock.lock()
            isRecording = false
            lock.unlock()
            throw RecordError.notAvailable
        }

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            recorder.startRecording { error in
                if let error {
                    self.lock.lock()
                    self.isRecording = false
                    self.lock.unlock()
                    cont.resume(throwing: RecordError.startFailed(error.localizedDescription))
                } else {
                    cont.resume()
                }
            }
        }
        #else
        lock.lock()
        isRecording = false
        lock.unlock()
        throw RecordError.notAvailable
        #endif
    }

    func stopRecording() async throws -> URL {
        lock.lock()
        guard isRecording else {
            lock.unlock()
            throw RecordError.stopFailed("Not recording")
        }
        lock.unlock()

        #if canImport(ReplayKit)
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("coreblow-screen-\(UUID().uuidString).mp4")

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            RPScreenRecorder.shared().stopRecording(withOutput: outputURL) { error in
                self.lock.lock()
                self.isRecording = false
                self.lock.unlock()
                if let error {
                    cont.resume(throwing: RecordError.stopFailed(error.localizedDescription))
                } else {
                    cont.resume()
                }
            }
        }
        return outputURL
        #else
        lock.lock()
        isRecording = false
        lock.unlock()
        throw RecordError.notAvailable
        #endif
    }
}
