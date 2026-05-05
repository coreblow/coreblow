import Foundation
enum DurationFormattingSupport { static func format(_ seconds: TimeInterval) -> String { if seconds < 60 { return String(format: "%.0fs", seconds) }; if seconds < 3600 { return String(format: "%.0fm", seconds/60) }; return String(format: "%.1fh", seconds/3600) } }
