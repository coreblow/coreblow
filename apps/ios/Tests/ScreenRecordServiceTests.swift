import Testing
@testable import CoreBlow

@Suite("ScreenRecordService")
struct ScreenRecordServiceTests {
    @Test func initialStateIsNotRecording() {
        let service = ScreenRecordService()
        #expect(!service.recording)
    }
}
