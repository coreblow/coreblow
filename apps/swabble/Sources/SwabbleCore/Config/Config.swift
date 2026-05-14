import Foundation

public struct SwabbleConfig: Codable, Sendable {
    public struct Audio: Codable, Sendable {
        public var deviceName: String = ""
        public var deviceIndex: Int = -1
        public var sampleRate: Double = 16000
        public var channels: Int = 1
    }
    public struct Wake: Codable, Sendable {
        public var enabled: Bool = true
        public var word: String = "cored"
        public var aliases: [String] = ["coreblow", "blowbot"]
    }
    public struct Hook: Codable, Sendable {
        public var command: String = ""
        public var args: [String] = []
        public var prefix: String = #"Voice swabble from ${hostname}: "#
        public var cooldownSeconds: Double = 1
        public var minCharacters: Int = 24
        public var timeoutSeconds: Double = 5
        public var env: [String: String] = [:]
    }
    public struct Logging: Codable, Sendable {
        public var level: String = "info"
        public var format: String = "text"
    }
    public struct Transcripts: Codable, Sendable {
        public var enabled: Bool = true
        public var maxEntries: Int = 50
    }
    public struct Speech: Codable, Sendable {
        public var localeIdentifier: String = Locale.current.identifier
        public var etiquetteReplacements: Bool = false
    }

    public var audio = Audio()
    public var wake = Wake()
    public var hook = Hook()
    public var logging = Logging()
    public var transcripts = Transcripts()
    public var speech = Speech()

    public static let defaultPath = FileManager.default
        .homeDirectoryForCurrentUser
        .appendingPathComponent(".config/swabble/config.json")

    public init() {}
}

public enum ConfigError: Error { case missingConfig }

public enum ConfigLoader {
    public static func load(at path: URL?) throws -> SwabbleConfig {
        let url = path ?? SwabbleConfig.defaultPath
        guard FileManager.default.fileExists(atPath: url.path) else { throw ConfigError.missingConfig }
        return try JSONDecoder().decode(SwabbleConfig.self, from: Data(contentsOf: url))
    }
    public static func save(_ config: SwabbleConfig, at path: URL?) throws {
        let url = path ?? SwabbleConfig.defaultPath
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(config).write(to: url, options: .atomic)
    }
}
