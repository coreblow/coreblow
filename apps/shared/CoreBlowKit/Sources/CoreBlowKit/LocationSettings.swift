import Foundation
public struct LocationSettings: Codable, Sendable { public var enabled: Bool = false; public var accuracy: String = "best"; public var updateInterval: TimeInterval = 60 }
