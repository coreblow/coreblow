import Foundation
enum TextSummarySupport { static func truncate(_ text: String, maxLength: Int = 100) -> String { text.count <= maxLength ? text : String(text.prefix(maxLength)) + "…" } }
