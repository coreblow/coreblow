import Foundation

enum CoreBlowEnv {
    static func path(_ key: String) -> String? {
        // Normalize env overrides once so UI + file IO stay consistent.
        guard let raw = getenv(key) else { return nil }
        let value = String(cString: raw).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty
        else {
            return nil
        }
        return value
    }
}

enum CoreBlowPaths {
    private static let configPathEnv = ["COREBLOW_CONFIG_PATH"]
    private static let stateDirEnv = ["COREBLOW_STATE_DIR"]

    static var stateDirURL: URL {
        for key in self.stateDirEnv {
            if let override = CoreBlowEnv.path(key) {
                return URL(fileURLWithPath: override, isDirectory: true)
            }
        }
        let home = FileManager().homeDirectoryForCurrentUser
        return home.appendingPathComponent(".coreblow", isDirectory: true)
    }

    private static func resolveConfigCandidate(in dir: URL) -> URL? {
        let candidates = [
            dir.appendingPathComponent("coreblow.json"),
        ]
        return candidates.first(where: { FileManager().fileExists(atPath: $0.path) })
    }

    static var configURL: URL {
        for key in self.configPathEnv {
            if let override = CoreBlowEnv.path(key) {
                return URL(fileURLWithPath: override)
            }
        }
        let stateDir = self.stateDirURL
        if let existing = self.resolveConfigCandidate(in: stateDir) {
            return existing
        }
        return stateDir.appendingPathComponent("coreblow.json")
    }

    static var workspaceURL: URL {
        self.stateDirURL.appendingPathComponent("workspace", isDirectory: true)
    }

    static var applicationSupport: URL {
        self.stateDirURL
    }

    static var logsDirectory: URL {
        self.stateDirURL.appendingPathComponent("logs", isDirectory: true)
    }

    /// Alias: many callers use `configFile` rather than `configURL`.
    static var configFile: URL { configURL }

    /// The directory containing the config file.
    static var configDirURL: URL { configURL.deletingLastPathComponent() }
}
