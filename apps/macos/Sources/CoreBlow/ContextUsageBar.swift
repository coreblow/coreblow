import SwiftUI
struct ContextUsageBar: View { let used: Int; let total: Int
    private var fraction: Double { total > 0 ? Double(used) / Double(total) : 0 }
    var body: some View { VStack(alignment: .leading, spacing: 2) { GeometryReader { geo in ZStack(alignment: .leading) { RoundedRectangle(cornerRadius: 3).fill(.quaternary).frame(height: 6); RoundedRectangle(cornerRadius: 3).fill(fraction > 0.9 ? .red : .accentColor).frame(width: geo.size.width * fraction, height: 6) } }.frame(height: 6); Text("\(used)/\(total)").font(.caption2).foregroundStyle(.secondary) } }
}
