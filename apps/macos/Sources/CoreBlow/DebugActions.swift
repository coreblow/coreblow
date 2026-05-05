import SwiftUI
struct DebugActions: View {
    var body: some View { VStack(alignment: .leading, spacing: 8) { Button("Reset Onboarding") { OnboardingState.reset() }; Button("Clear Endpoint Cache") { UserDefaults.standard.removeObject(forKey: "coreblow.endpoints") }; Button("Force Reconnect") { /* trigger reconnect */ } } }
}
