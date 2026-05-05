import Foundation
enum ConfigSchemaSupport {
    static func validate(_ config: CoreBlowConfigFile) -> [String] {
        var issues: [String] = []
        if let port = config.gateway?.port, port == 0 { issues.append("gateway.port must be > 0") }
        if let words = config.voice?.triggerWords, words.isEmpty { issues.append("voice.triggerWords must not be empty") }
        return issues
    }
}
