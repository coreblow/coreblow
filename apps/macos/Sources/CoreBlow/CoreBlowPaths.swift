import Foundation
enum CoreBlowPaths {
    static var applicationSupport: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("CoreBlow")
    }
    static var logsDirectory: URL { applicationSupport.appendingPathComponent("logs") }
    static var configFile: URL { applicationSupport.appendingPathComponent("config.json") }
    static var canvasDirectory: URL { applicationSupport.appendingPathComponent("canvas") }
    static var controlSocket: URL { applicationSupport.appendingPathComponent(Constants.controlSocketName) }
    static var gatewayBinary: URL { applicationSupport.appendingPathComponent("gateway") }
    static func ensureDirectoryExists(_ url: URL) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    }
}
