import Commander; import Foundation; import Swabble
@MainActor struct TailLogCommand: ParsableCommand {
    static var commandDescription: CommandDescription { CommandDescription(commandName: "tail-log", abstract: "Tail recent transcripts") }
    init() {}; init(parsed: ParsedValues) {}
    mutating func run() async throws { for line in await TranscriptsStore.shared.latest().suffix(10) { print(line) } }
}
