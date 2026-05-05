import Foundation
public enum BonjourServiceType { public static let gateway = "_coreblow._tcp" }
public struct BonjourTXTRecord: Sendable { public let version: String; public let port: UInt16; public let name: String?
    public init(version: String, port: UInt16, name: String?) { self.version = version; self.port = port; self.name = name } }
