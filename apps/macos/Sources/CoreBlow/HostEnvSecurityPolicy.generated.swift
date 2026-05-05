import Foundation
enum HostEnvSecurityPolicy { static let version = 1; static let blockedPrefixes = ["AWS_", "GH_", "GITHUB_", "OPENAI_", "ANTHROPIC_", "AZURE_"]; static func isBlocked(_ key: String) -> Bool { blockedPrefixes.contains(where: { key.hasPrefix($0) }) || key.contains("SECRET") || key.contains("TOKEN") || key.contains("PASSWORD") || key.contains("KEY") } }
