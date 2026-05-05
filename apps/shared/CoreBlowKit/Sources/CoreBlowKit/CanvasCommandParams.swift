import Foundation
public struct CanvasCommandParams: Codable, Sendable { public let session: String; public let path: String?; public let javaScript: String?
    public init(session: String, path: String? = nil, javaScript: String? = nil) { self.session = session; self.path = path; self.javaScript = javaScript } }
