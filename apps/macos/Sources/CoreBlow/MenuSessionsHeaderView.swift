import SwiftUI
import OSLog
import CoreBlowKit
import OSLog

struct MenuSessionsHeaderView: View {
    let count: Int
    var statusText: String? = nil

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Sessions")
                    .font(.caption.weight(.semibold))
                if let statusText {
                    Text(statusText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    Text("\(count) active")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }
}
