import Foundation
enum SessionActions {
    static func formatSessionAge(_ startedAt: Date) -> String {
        let interval = Date().timeIntervalSince(startedAt)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        return "\(Int(interval / 86400))d ago"
    }
}
