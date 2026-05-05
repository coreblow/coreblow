import Commander; import Foundation; import Speech; import Swabble
@MainActor struct DoctorCommand: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "doctor", abstract: "Check system prerequisites") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws {
        print("Speech recognition: \(SFSpeechRecognizer.authorizationStatus() == .authorized ? "✅" : "❌")")
        print("Microphone access: \(AVCaptureDevice.authorizationStatus(for: .audio) == .authorized ? "✅" : "❌")")
        print("Config path: \(SwabbleConfig.defaultPath.path)")
        print("Config exists: \(FileManager.default.fileExists(atPath: SwabbleConfig.defaultPath.path) ? "✅" : "❌")")
    }
}
