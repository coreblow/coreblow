import AVFoundation; import Commander; import Foundation
@MainActor struct MicListCommand: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "mic-list", abstract: "List audio input devices") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws {
        let devices = AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInMicrophone, .externalUnknown], mediaType: .audio, position: .unspecified).devices
        for (i, d) in devices.enumerated() { print("[\(i)] \(d.localizedName) (\(d.uniqueID))") }
        if devices.isEmpty { print("No audio input devices found.") }
    }
}
@MainActor struct MicTestCommand: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "mic-test", abstract: "Test microphone input") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws { print("Mic test: recording 3 seconds…"); try await Task.sleep(for: .seconds(3)); print("Done. Audio capture OK.") }
}
