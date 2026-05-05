import SwiftUI

/// Step-by-step onboarding wizard with mode selection.
struct OnboardingWizardView: View {
    @ObservedObject var discovery: GatewayDiscoveryModel
    let settingsStore: GatewaySettingsStore
    let onConnect: (GatewayConnectConfig) -> Void
    let onComplete: () -> Void

    @State private var selectedMode: OnboardingConnectionMode = .scan
    @State private var manualHost = ""
    @State private var manualPort = "8080"
    @State private var showQRScanner = false
    @State private var step = 0

    var body: some View {
        NavigationStack {
            VStack {
                switch step {
                case 0: modeSelectionView
                case 1: connectionView
                default: EmptyView()
                }
            }
            .navigationTitle("Setup")
            .toolbar {
                if step > 0 {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Back") { step = 0 }
                    }
                }
            }
        }
        .sheet(isPresented: $showQRScanner) {
            QRScannerView { code in
                if let setup = GatewaySetupCode.parse(code) {
                    showQRScanner = false
                    OnboardingStateStore.markCompleted(mode: .qrCode)
                    onConnect(setup.config)
                }
            }
        }
    }

    private var modeSelectionView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("How would you like to connect?")
                .font(.title2.bold())

            ForEach(OnboardingConnectionMode.allCases, id: \.self) { mode in
                Button {
                    selectedMode = mode
                    if mode == .qrCode {
                        showQRScanner = true
                    } else {
                        step = 1
                    }
                } label: {
                    Label(mode.label, systemImage: mode.icon)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private var connectionView: some View {
        Group {
            switch selectedMode {
            case .scan:
                GatewayOnboardingView(
                    discovery: discovery,
                    settingsStore: settingsStore,
                    onConnect: { config in
                        OnboardingStateStore.markCompleted(mode: .scan)
                        onConnect(config)
                    },
                    onSkip: {
                        OnboardingStateStore.markCompleted(mode: .scan)
                        onComplete()
                    })

            case .manual:
                VStack(spacing: 16) {
                    TextField("Host", text: $manualHost)
                        .textContentType(.URL)
                        .autocorrectionDisabled()
                    TextField("Port", text: $manualPort)
                        .keyboardType(.numberPad)
                    Button("Connect") {
                        let port = Int(manualPort) ?? 8080
                        let config = GatewayConnectConfig(host: manualHost, port: port)
                        OnboardingStateStore.markCompleted(mode: .manual)
                        onConnect(config)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(manualHost.isEmpty)
                }
                .padding(24)

            case .qrCode:
                EmptyView()
            }
        }
    }
}
