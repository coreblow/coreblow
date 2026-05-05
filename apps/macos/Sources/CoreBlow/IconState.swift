import AppKit
enum IconState { case connected, disconnected, error, reconnecting
    var systemImageName: String { switch self { case .connected: "bolt.fill"; case .disconnected: "bolt.slash"; case .error: "exclamationmark.triangle"; case .reconnecting: "arrow.clockwise" } }
}
