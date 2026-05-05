import SwiftUI
struct GeneralSettings: View { @State private var config = ConfigStore()
    var body: some View { Form { Section("Gateway") { TextField("Host", text: $config.gatewayHost); TextField("Port", value: $config.gatewayPort, format: .number); Toggle("Use TLS", isOn: $config.useTLS); Toggle("Auto-start", isOn: $config.autoStart) }; Section("App") { Toggle("Show in Dock", isOn: $config.showInDock); Toggle("Show in Menu Bar", isOn: $config.showInMenuBar) } }.formStyle(.grouped).onAppear { config.load() }.onDisappear { config.save() } }
}
