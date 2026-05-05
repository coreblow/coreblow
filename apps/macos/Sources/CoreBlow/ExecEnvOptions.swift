import Foundation
struct ExecEnvOptions { let clearEnv: Bool; let overrides: [String: String]
    static func from(env: [String: String]?) -> ExecEnvOptions {
        ExecEnvOptions(clearEnv: false, overrides: env ?? [:])
    }
}
