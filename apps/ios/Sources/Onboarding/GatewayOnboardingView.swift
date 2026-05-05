import Foundation
import SwiftUI

/// Full-screen onboarding view for first-time gateway setup.
struct GatewayOnboardingView: View {
    @ObservedObject var discovery: GatewayDiscoveryModel
    let settingsStore: GatewaySettingsStore
    let onConnect: (GatewayConnectConfig) -> Void
    let onSkip: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 64))
                    .foregroundStyle(.blue.gradient)

                Text("Connect to Gateway")
                    .font(.title.bold())

                Text("Scan your network for a CoreBlow gateway, scan a QR code, or enter the address manually.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Spacer()

                // Discovered list
                if !discovery.discoveredEndpoints.isEmpty {
                    VStack(spacing: 8) {
                        ForEach(discovery.discoveredEndpoints) { ep in
                            Button {
                                onConnect(ep)
                            } label: {
                                HStack {
                                    Image(systemName: "server.rack")
                                    Text(ep.label)
                                    Spacer()
                                    Image(systemName: "arrow.right.circle")
                                }
                                .padding()
                                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                if discovery.isScanning {
                    ProgressView("Scanning…")
                }

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        discovery.isScanning ? discovery.stopScan() : discovery.startScan()
                    } label: {
                        Label(
                            discovery.isScanning ? "Stop Scan" : "Scan Network",
                            systemImage: discovery.isScanning ? "stop.circle" : "antenna.radiowaves.left.and.right"
                        )
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button("Skip for Now", action: onSkip)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
            }
            .onAppear { discovery.startScan() }
        }
    }
}
