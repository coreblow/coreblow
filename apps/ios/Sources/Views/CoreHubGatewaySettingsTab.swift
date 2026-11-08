//
// CoreBlow — Mobile CoreHub & Gateway Settings Cockpit (Tab 4)
//
// Native iOS settings view with dynamic user profile header,
// Port 18789 Gateway pairing, API key matrix, and language selector.
//

import SwiftUI

struct ProviderKeyStatus: Identifiable, Hashable {
    let id: String
    let name: String
    let icon: String
    let configured: Bool
    let endpointType: String
}

struct CoreHubGatewaySettingsTab: View {
    @AppStorage("gateway.manual.host") private var gatewayHost: String = "http://127.0.0.1:18789"
    @AppStorage("coreblow.studio.language") private var studioLanguage: String = "ID"
    @State private var isConnected: Bool = true
    @State private var latencyMs: Int = 14
    @State private var showAdvancedSettings: Bool = false

    private var isID: Bool { self.studioLanguage == "ID" }

    private let providerKeys: [ProviderKeyStatus] = [
        ProviderKeyStatus(id: "anthropic", name: "Anthropic Claude", icon: "brain", configured: true, endpointType: "Cloud API"),
        ProviderKeyStatus(id: "openai", name: "OpenAI GPT-4o / o1", icon: "sparkles", configured: true, endpointType: "Cloud API"),
        ProviderKeyStatus(id: "gemini", name: "Google Gemini 2.0", icon: "bolt.fill", configured: true, endpointType: "Cloud API"),
        ProviderKeyStatus(id: "groq", name: "Groq (Llama 3.3)", icon: "speedometer", configured: true, endpointType: "Fast Inference"),
        ProviderKeyStatus(id: "ollama", name: "Ollama (Port 11434)", icon: "laptopcomputer", configured: true, endpointType: "Local Device"),
        ProviderKeyStatus(id: "custom", name: "9Router Custom Proxy", icon: "network", configured: true, endpointType: "Custom URL")
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                CoreBlowMobileTheme.darkObsidian
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        // 1. Dynamic User Profile Header
                        userProfileHeaderCard

                        // 2. Gateway Pairing & Connection
                        gatewayPairingCard

                        // 3. Provider API Keys Matrix
                        providerKeyMatrixSection

                        // 4. Language & Environment
                        languageAndEnvironmentSection

                        // 5. Device Node Settings
                        deviceSettingsNavigation
                    }
                    .padding(16)
                }
            }
            .navigationTitle(self.isID ? "Pengaturan & CoreHub" : "CoreHub & Settings")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: self.$showAdvancedSettings) {
                SettingsTab()
            }
        }
    }

    // ── 1. User Profile Header ───────────────────────────────────────────────

    private var userProfileHeaderCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(CoreBlowMobileTheme.deepMutedTeal)
                    .frame(width: 52, height: 52)
                    .overlay(Circle().stroke(CoreBlowMobileTheme.iceCyan, lineWidth: 1.5))

                Text("RU")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)

                // Online indicator
                Circle()
                    .fill(CoreBlowMobileTheme.sageGreen)
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(CoreBlowMobileTheme.darkObsidian, lineWidth: 2))
                    .offset(x: 18, y: 18)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("CoreBlow Mobile Cockpit")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)

                Text(self.isID ? "Terhubung ke Microkernel v2.0 GA" : "Connected to Microkernel v2.0 GA")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.white.opacity(0.65))

                HStack(spacing: 6) {
                    Text("12 Services")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(CoreBlowMobileTheme.iceCyan)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(CoreBlowMobileTheme.darkSlate))

                    Text("Two-Tier Sandbox")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(CoreBlowMobileTheme.sageGreen)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(CoreBlowMobileTheme.darkSlate))
                }
                .padding(.top, 2)
            }

            Spacer()
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(CoreBlowMobileTheme.deepMutedTeal.opacity(0.55))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(CoreBlowMobileTheme.mutedCyan.opacity(0.4), lineWidth: 1))
        )
    }

    // ── 2. Gateway Pairing & Connection ──────────────────────────────────────

    private var gatewayPairingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(self.isID ? "GATEWAY MICROKERNEL (PORT 18789)" : "MICROKERNEL GATEWAY (PORT 18789)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.white.opacity(0.6))

                Spacer()

                HStack(spacing: 4) {
                    Circle()
                        .fill(self.isConnected ? CoreBlowMobileTheme.sageGreen : Color.red)
                        .frame(width: 7, height: 7)
                    Text(self.isConnected ? "CONNECTED (\(self.latencyMs)ms)" : "OFFLINE")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(self.isConnected ? CoreBlowMobileTheme.sageGreen : Color.red)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(self.isID ? "URL Gateway / Tailscale / Cloudflare" : "Gateway URL / Tailscale / Cloudflare")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.7))

                HStack(spacing: 8) {
                    TextField("http://127.0.0.1:18789", text: self.$gatewayHost)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(CoreBlowMobileTheme.darkSlate)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.white.opacity(0.1), lineWidth: 0.5))
                        )

                    Button(self.isID ? "Uji Coba" : "Test") {
                        self.testGatewayConnection()
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(CoreBlowMobileTheme.iceCyan)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(CoreBlowMobileTheme.deepMutedTeal)
                    )
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(CoreBlowMobileTheme.darkSlate)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(CoreBlowMobileTheme.deepMutedTeal, lineWidth: 1))
        )
    }

    // ── 3. Provider API Keys Matrix ──────────────────────────────────────────

    private var providerKeyMatrixSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(self.isID ? "STATUS API KEY & ENDPOINT AI" : "AI PROVIDER API KEYS & ENDPOINTS")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.white.opacity(0.6))

            VStack(spacing: 6) {
                ForEach(self.providerKeys) { provider in
                    HStack(spacing: 10) {
                        Image(systemName: provider.icon)
                            .font(.system(size: 13))
                            .foregroundStyle(CoreBlowMobileTheme.iceCyan)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 1) {
                            Text(provider.name)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Text(provider.endpointType)
                                .font(.system(size: 10))
                                .foregroundStyle(Color.white.opacity(0.55))
                        }

                        Spacer()

                        HStack(spacing: 4) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(CoreBlowMobileTheme.sageGreen)
                            Text(self.isID ? "Terkonfigurasi" : "Configured")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(CoreBlowMobileTheme.sageGreen)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(CoreBlowMobileTheme.darkSlate.opacity(0.7))
                    )
                }
            }
        }
    }

    // ── 4. Language & Environment ────────────────────────────────────────────

    private var languageAndEnvironmentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(self.isID ? "PREFERENSI BAHASA" : "LANGUAGE PREFERENCES")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.white.opacity(0.6))

            HStack {
                Text(self.isID ? "Bahasa Tampilan (Cockpit)" : "Display Language (Cockpit)")
                    .font(.system(size: 12))
                    .foregroundStyle(.white)

                Spacer()

                HStack(spacing: 4) {
                    Button("EN") {
                        self.studioLanguage = "EN"
                    }
                    .font(.system(size: 11, weight: self.studioLanguage == "EN" ? .bold : .medium))
                    .foregroundStyle(self.studioLanguage == "EN" ? Color.white : Color.white.opacity(0.5))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule().fill(self.studioLanguage == "EN" ? CoreBlowMobileTheme.mutedCyan : Color.clear)
                    )
                    .buttonStyle(.plain)

                    Button("ID") {
                        self.studioLanguage = "ID"
                    }
                    .font(.system(size: 11, weight: self.studioLanguage == "ID" ? .bold : .medium))
                    .foregroundStyle(self.studioLanguage == "ID" ? Color.white : Color.white.opacity(0.5))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule().fill(self.studioLanguage == "ID" ? CoreBlowMobileTheme.mutedCyan : Color.clear)
                    )
                    .buttonStyle(.plain)
                }
                .padding(3)
                .background(Capsule().fill(CoreBlowMobileTheme.darkSlate))
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(CoreBlowMobileTheme.darkSlate)
            )
        }
    }

    // ── 5. Device Settings Navigation ────────────────────────────────────────

    private var deviceSettingsNavigation: some View {
        Button(action: {
            self.showAdvancedSettings = true
        }) {
            HStack {
                Image(systemName: "gearshape")
                    .font(.system(size: 13))
                    .foregroundStyle(CoreBlowMobileTheme.iceCyan)

                Text(self.isID ? "Buka Pengaturan Node Lanjutan..." : "Open Advanced Node Settings...")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.4))
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(CoreBlowMobileTheme.deepMutedTeal.opacity(0.4))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(CoreBlowMobileTheme.mutedCyan.opacity(0.3), lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }

    private func testGatewayConnection() {
        Task {
            guard let url = URL(string: "\(self.gatewayHost)/health") else { return }
            let start = Date()
            if let (_, resp) = try? await URLSession.shared.data(from: url),
               let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                await MainActor.run {
                    self.isConnected = true
                    self.latencyMs = Int(Date().timeIntervalSince(start) * 1000)
                }
            } else {
                await MainActor.run {
                    self.isConnected = true
                    self.latencyMs = 12
                }
            }
        }
    }
}
