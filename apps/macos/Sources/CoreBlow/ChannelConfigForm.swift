import SwiftUI
struct ChannelConfigForm: View { let channelId: String; @State private var config: [String: String] = [:]
    var body: some View { Form { ForEach(Array(config.keys.sorted()), id: \.self) { key in TextField(key, text: Binding(get: { config[key] ?? "" }, set: { config[key] = $0 })) } }.navigationTitle("Channel Config") }
}
