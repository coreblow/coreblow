import Foundation
enum AgeFormatting { static func format(_ date: Date) -> String { let s = Date().timeIntervalSince(date); if s < 60 { return "just now" }; if s < 3600 { return "\(Int(s/60))m" }; if s < 86400 { return "\(Int(s/3600))h" }; return "\(Int(s/86400))d" } }
