import Foundation
public enum BridgeFrameType: UInt8, Sendable { case text = 1; case binary = 2; case ping = 3; case pong = 4; case close = 5 }
public struct BridgeFrame: Sendable { public let type: BridgeFrameType; public let payload: Data
    public init(type: BridgeFrameType, payload: Data) { self.type = type; self.payload = payload }
    public func encode() -> Data { var d = Data([type.rawValue]); var len = UInt32(payload.count).bigEndian; d.append(Data(bytes: &len, count: 4)); d.append(payload); return d }
}
