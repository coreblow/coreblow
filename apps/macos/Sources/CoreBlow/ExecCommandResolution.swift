import Foundation
enum ExecCommandResolution {
    static func resolveExecutable(_ name: String) -> URL? {
        let searchPaths = ["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin", "/usr/sbin"]
        for dir in searchPaths { let url = URL(fileURLWithPath: dir).appendingPathComponent(name); if FileManager.default.isExecutableFile(atPath: url.path) { return url } }
        return nil
    }
}
