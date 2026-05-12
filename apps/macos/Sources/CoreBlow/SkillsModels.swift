import Foundation
import OSLog
import CoreBlowKit
import OSLog

// MARK: - Basic Skill (legacy)

struct Skill: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    var isEnabled: Bool
    let version: String?
}

// MARK: - Skills Status Models (gateway parity)

struct SkillStatus: Identifiable, Codable {
    let name: String
    let description: String
    let source: String
    let filePath: String?
    let baseDir: String?
    let skillKey: String
    let primaryEnv: String?
    let emoji: String?
    let homepage: String?
    let always: Bool
    var disabled: Bool
    let eligible: Bool
    let requirements: SkillRequirements
    let missing: SkillMissing
    let configChecks: [SkillStatusConfigCheck]
    let install: [SkillInstallOption]

    var id: String { skillKey }
}

struct SkillRequirements: Codable {
    let bins: [String]
    let env: [String]
    let config: [String]
}

struct SkillMissing: Codable {
    let bins: [String]
    let env: [String]
    let config: [String]
}

struct SkillStatusConfigCheck: Identifiable, Codable {
    let path: String
    let value: AnyCodable?
    let satisfied: Bool

    var id: String { path }
}

struct SkillInstallOption: Identifiable, Codable {
    let id: String
    let kind: String
    let label: String
    let bins: [String]
}

// MARK: - RPC Response Types

struct SkillsStatusReport: Codable {
    let skills: [SkillStatus]
}

struct SkillsInstallResult: Codable {
    let ok: Bool
    let message: String?
}

struct SkillsUpdateResult: Codable {
    let ok: Bool
    let message: String?
}
