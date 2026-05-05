import Foundation
enum TestIsolation { static func tempDirectory() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString) }
    static func cleanup(_ url: URL) { try? FileManager.default.removeItem(at: url) } }
