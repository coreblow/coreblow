import Foundation
import OSLog
actor DiagnosticsFileLog {
    private let fileURL: URL
    private var handle: FileHandle?
    private let dateFormatter: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
    init(directory: URL, filename: String = "diagnostics.log") {
        self.fileURL = directory.appendingPathComponent(filename)
    }
    func open() throws {
        try CoreBlowPaths.ensureDirectoryExists(fileURL.deletingLastPathComponent())
        if !FileManager.default.fileExists(atPath: fileURL.path) {
            FileManager.default.createFile(atPath: fileURL.path, contents: nil)
        }
        handle = try FileHandle(forWritingTo: fileURL)
        handle?.seekToEndOfFile()
    }
    func write(_ message: String, level: String = "INFO") {
        let line = "[\(dateFormatter.string(from: Date()))] [\(level)] \(message)\n"
        handle?.write(Data(line.utf8))
    }
    func close() { try? handle?.close(); handle = nil }
}
