import Foundation; import ScreenCaptureKit
@MainActor final class ScreenRecordService {
    private(set) var isRecording = false
    func startRecording(screenIndex: Int, fps: Double, includeAudio: Bool) async throws { isRecording = true }
    func stopRecording() async throws -> Data? { isRecording = false; return nil }
}
