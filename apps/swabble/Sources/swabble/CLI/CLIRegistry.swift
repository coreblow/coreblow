import Commander
import Foundation

enum CLIRegistry {
    @MainActor static func run() async {
        let root = Group(name: "swabble", description: "Speech.framework wake-word hook daemon") {
            ServeCommand.self; SetupCommand.self; StatusCommand.self
            DoctorCommand.self; HealthCommand.self; TailLogCommand.self
            TestHookCommand.self; TranscribeCommand.self
            StartCommand.self; StopCommand.self; RestartCommand.self
            MicListCommand.self; MicTestCommand.self
            ServiceInstall.self; ServiceUninstall.self; ServiceStatus.self
        }
        await root.run()
    }
}
