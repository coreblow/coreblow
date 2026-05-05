import Foundation
enum HostEnvSanitizer {
    private static let blockedKeys: Set<String> = ["AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN", "NPM_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
    static func sanitize(_ env: [String: String]) -> [String: String] { env.filter { !blockedKeys.contains($0.key) && !$0.key.contains("SECRET") && !$0.key.contains("PASSWORD") } }
}
