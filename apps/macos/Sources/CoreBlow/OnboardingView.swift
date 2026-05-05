import SwiftUI
struct OnboardingView: View { @State var currentPage = 0; let totalPages = 4
    var body: some View { VStack { TabView(selection: $currentPage) { ForEach(0..<totalPages, id: \.self) { i in OnboardingPageView(index: i).tag(i) } }.tabViewStyle(.automatic); HStack { if currentPage > 0 { Button("Back") { currentPage -= 1 } }; Spacer(); Button(currentPage < totalPages - 1 ? "Next" : "Get Started") { if currentPage < totalPages - 1 { currentPage += 1 } else { completeOnboarding() } }.buttonStyle(.borderedProminent) }.padding() }.frame(width: 500, height: 400) }
}
private struct OnboardingPageView: View { let index: Int; var body: some View { VStack { Image(systemName: ["bolt.fill", "antenna.radiowaves.left.and.right", "mic.fill", "checkmark.circle.fill"][index]).font(.system(size: 48)); Text(["Welcome", "Connect", "Voice", "Ready"][index]).font(.title) }.padding() } }
