import SwiftUI
struct OnboardingCard: View { let icon: String; let title: String; let description: String
    var body: some View { VStack(spacing: 8) { Image(systemName: icon).font(.largeTitle).foregroundStyle(.tint); Text(title).font(.headline); Text(description).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center) }.padding() }
}
