import Foundation
import OSLog
enum CoreBlowLogging {
    static let general = Logger(subsystem: Constants.bundleIdentifier, category: "general")
    static let gateway = Logger(subsystem: Constants.bundleIdentifier, category: "gateway")
    static let ipc = Logger(subsystem: Constants.bundleIdentifier, category: "ipc")
    static let voice = Logger(subsystem: Constants.bundleIdentifier, category: "voice")
    static let canvas = Logger(subsystem: Constants.bundleIdentifier, category: "canvas")
    static let node = Logger(subsystem: Constants.bundleIdentifier, category: "node")
}
