import SwiftUI

/// Quick setup sheet for first-time gateway pairing.
struct GatewayQuickSetupSheet: View {
    @ObservedObject var discovery: GatewayDiscoveryModel
    let onConnect: (GatewayConnectConfig) -> Void
    let onManual: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var manualHost = ""
    @State private var manualPort = "8080"

    var body: some View {
        NavigationStack {
            List {
                Section("Discovered Gateways") {
                    if discovery.isScanning {
                        HStack {
                            ProgressView()
                            Text("Scanning...")
                                .foregroundStyle(.secondary)
                        }
                    }

                    ForEach(discovery.discoveredEndpoints) { endpoint in
                        Button {
                            onConnect(endpoint)
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(endpoint.label).font(.body)
                                    Text("\(endpoint.host):\(endpoint.port)")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.right.circle")
                            }
                        }
                    }

                    if discovery.discoveredEndpoints.isEmpty && !discovery.isScanning {
                        Text("No gateways found on this network.")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Manual Connection") {
                    TextField("Host", text: $manualHost)
                        .textContentType(.URL)
                        .autocorrectionDisabled()
                    TextField("Port", text: $manualPort)
                        .keyboardType(.numberPad)
                    Button("Connect") {
                        let port = Int(manualPort) ?? 8080
                        let config = GatewayConnectConfig(host: manualHost, port: port)
                        onConnect(config)
                        dismiss()
                    }
                    .disabled(manualHost.isEmpty)
                }
            }
            .navigationTitle("Connect to Gateway")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button(discovery.isScanning ? "Stop" : "Scan") {
                        discovery.isScanning ? discovery.stopScan() : discovery.startScan()
                    }
                }
            }
            .onAppear { discovery.startScan() }
        }
    }
}
