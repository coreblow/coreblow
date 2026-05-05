import SwiftUI
struct MenuUsageHeaderView: View { let tokenCount: Int; var body: some View { HStack { Label("\(tokenCount) tokens", systemImage: "chart.bar.fill").font(.caption2); Spacer() }.padding(.horizontal, 12).padding(.vertical, 4) } }
