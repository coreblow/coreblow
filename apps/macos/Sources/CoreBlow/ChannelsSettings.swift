import SwiftUI
struct ChannelsSettings: View { @State private var store = ChannelsStore()
    var body: some View { List(store.channels) { ch in HStack { Toggle(ch.name, isOn: Binding(get: { ch.enabled }, set: { _ in store.toggle(id: ch.id) })); Spacer(); Text(ch.type).font(.caption).foregroundStyle(.secondary) } }.navigationTitle("Channels").task { await store.load() } }
}
