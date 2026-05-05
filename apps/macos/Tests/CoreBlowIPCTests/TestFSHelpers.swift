import Foundation
enum TestFSHelpers { static func createTempFile(content: String) -> URL { let url = TestIsolation.tempDirectory().appendingPathComponent("test.txt"); try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true); try? content.data(using: .utf8)?.write(to: url); return url } }
