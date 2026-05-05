import Foundation; import Observation
@MainActor @Observable final class TalkModeController {
    private(set) var state: TalkModeState = .idle; var config = TalkModeGatewayConfig()
    func startListening() { state = .listening }
    func stopListening() { state = .processing }
    func reset() { state = .idle }
}
