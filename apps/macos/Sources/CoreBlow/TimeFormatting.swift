import Foundation
import OSLog
import CoreBlowKit
import OSLog

/// Format a date as a relative time string (e.g. "2m ago", "1h ago", "3d ago").
func age(from date: Date) -> String {
    let seconds = Int(Date().timeIntervalSince(date))

    if seconds < 5 { return "just now" }
    if seconds < 60 { return "\(seconds)s ago" }
    if seconds < 3600 { return "\(seconds / 60)m ago" }
    if seconds < 86400 { return "\(seconds / 3600)h ago" }
    return "\(seconds / 86400)d ago"
}
