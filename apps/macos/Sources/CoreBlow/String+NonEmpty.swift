import Foundation
extension String { var nonEmpty: String? { let t = trimmingCharacters(in: .whitespacesAndNewlines); return t.isEmpty ? nil : t } }
