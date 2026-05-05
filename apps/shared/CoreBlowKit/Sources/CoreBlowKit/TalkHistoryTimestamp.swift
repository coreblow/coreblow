import Foundation
public enum TalkHistoryTimestamp {
    private static let formatter: DateFormatter = { let f = DateFormatter(); f.dateFormat = "HH:mm:ss"; return f }()
    public static func format(_ date: Date) -> String { formatter.string(from: date) }
    public static func elapsedSince(_ start: Date) -> String { let s = Date().timeIntervalSince(start); return String(format: "%02d:%02d", Int(s) / 60, Int(s) % 60) }
}
