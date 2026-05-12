import Foundation
import OSLog
import CoreBlowKit
import OSLog

extension Process {
    /// Runs the process and drains the given pipe before waiting to avoid blocking on full buffers.
    func runAndReadToEnd(from pipe: Pipe) throws -> Data {
        try self.run()
        let data = pipe.fileHandleForReading.readToEndSafely()
        self.waitUntilExit()
        return data
    }
}
