import SwiftUI
struct MenuSessionsHeaderView: View { let count: Int; var body: some View { HStack { Text("Sessions (\(count))").font(.caption).foregroundStyle(.secondary); Spacer() }.padding(.horizontal) } }
