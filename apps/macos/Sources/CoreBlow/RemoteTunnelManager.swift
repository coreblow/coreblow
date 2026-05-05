import Foundation; import Observation
@MainActor @Observable final class RemoteTunnelManager { private(set) var isActive = false; func activate(host: String, port: UInt16) async { isActive = true }; func deactivate() { isActive = false } }
