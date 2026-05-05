import Foundation
public struct InstanceIdentity: Codable, Sendable { public let instanceId: String; public let version: String; public let startedAt: Date
    public static func current() -> InstanceIdentity { InstanceIdentity(instanceId: UUID().uuidString, version: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0", startedAt: Date()) } }
