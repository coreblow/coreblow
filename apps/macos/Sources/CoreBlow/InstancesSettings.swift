import SwiftUI
struct InstancesSettings: View { @State private var store = InstancesStore()
    var body: some View { List(store.instances) { instance in HStack { Text(instance.name); Spacer(); Text(instance.status).foregroundStyle(.secondary) } }.navigationTitle("Instances") }
}
