import Foundation
public struct CanvasA2UIAction: Codable, Sendable { public let type: String; public let data: AnyCodable?
    public init(type: String, data: AnyCodable? = nil) { self.type = type; self.data = data } }
