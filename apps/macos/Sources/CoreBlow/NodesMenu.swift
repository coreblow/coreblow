import SwiftUI
struct NodesMenu: View { @State private var store = NodesStore()
    var body: some View { if store.nodes.isEmpty { Text("No nodes connected").foregroundStyle(.secondary) } else { ForEach(store.nodes) { n in HStack { CritterStatusLabel(name: n.name, isOnline: true); Spacer(); Text(n.platform).font(.caption2) } } } }
}
