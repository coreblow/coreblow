import SwiftUI

struct RootTabs: View {
    @Environment(NodeAppModel.self) private var appModel
    @Environment(VoiceWakeManager.self) private var voiceWake
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage(VoiceWakePreferences.enabledKey) private var voiceWakeEnabled: Bool = false
    @State private var selectedTab: Int = 0
    @State private var voiceWakeToastText: String?
    @State private var toastDismissTask: Task<Void, Never>?
    @State private var showGatewayActions: Bool = false

    var body: some View {
        TabView(selection: self.$selectedTab) {
            CoryChatVoiceTab()
                .tabItem { Label("Chat", systemImage: "message.fill") }
                .tag(0)

            WarRoomMonitorTab()
                .tabItem { Label("War Room", systemImage: "person.3.fill") }
                .tag(1)

            PrGateApprovalTab()
                .tabItem { Label("PR Approval", systemImage: "checkmark.shield.fill") }
                .tag(2)

            CoreHubGatewaySettingsTab()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                .tag(3)
        }
        .tint(CoreBlowMobileTheme.iceCyan)
        .overlay(alignment: .topLeading) {
            StatusPill(
                gateway: self.gatewayStatus,
                voiceWakeEnabled: self.voiceWakeEnabled,
                activity: self.statusActivity,
                onTap: {
                    if self.gatewayStatus == .connected {
                        self.showGatewayActions = true
                    } else {
                        self.selectedTab = 3
                    }
                })
                .padding(.leading, 10)
                .safeAreaPadding(.top, 10)
        }
        .overlay(alignment: .topLeading) {
            if let voiceWakeToastText, !voiceWakeToastText.isEmpty {
                VoiceWakeToast(command: voiceWakeToastText)
                    .padding(.leading, 10)
                    .safeAreaPadding(.top, 58)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onChange(of: self.voiceWake.lastTriggeredCommand) { _, newValue in
            guard let newValue else { return }
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }

            self.toastDismissTask?.cancel()
            withAnimation(self.reduceMotion ? .none : .spring(response: 0.25, dampingFraction: 0.85)) {
                self.voiceWakeToastText = trimmed
            }

            self.toastDismissTask = Task {
                try? await Task.sleep(nanoseconds: 2_300_000_000)
                await MainActor.run {
                    withAnimation(self.reduceMotion ? .none : .easeOut(duration: 0.25)) {
                        self.voiceWakeToastText = nil
                    }
                }
            }
        }
        .onDisappear {
            self.toastDismissTask?.cancel()
            self.toastDismissTask = nil
        }
        .gatewayActionsDialog(
            isPresented: self.$showGatewayActions,
            onDisconnect: { self.appModel.disconnectGateway() },
            onOpenSettings: { self.selectedTab = 3 })
    }

    private var gatewayStatus: StatusPill.GatewayState {
        GatewayStatusBuilder.build(appModel: self.appModel)
    }

    private var statusActivity: StatusPill.Activity? {
        StatusActivityBuilder.build(
            appModel: self.appModel,
            voiceWakeEnabled: self.voiceWakeEnabled,
            cameraHUDText: self.appModel.cameraHUDText,
            cameraHUDKind: self.appModel.cameraHUDKind)
    }
}
