import Foundation
public enum StoragePaths {
    public static var applicationSupport: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("CoreBlow") }
    public static var documents: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first! }
    public static var caches: URL { FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!.appendingPathComponent("CoreBlow") }
    public static func ensure(_ url: URL) throws { try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true) }
}
