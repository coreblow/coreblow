import OSLog
import CoreBlowKit

extension Logger {
    /// Compatibility property to match swift-log's Logger.logLevel.
    /// OSLog doesn't expose the current log level, so we default to .debug
    /// which enables all diagnostic logging in voice-wake pipelines.
    var logLevel: OSLogType { .debug }
}
