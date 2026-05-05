import SwiftUI
struct AboutSettings: View {
    var body: some View { VStack(spacing: 12) { Image(systemName: "bolt.fill").font(.system(size: 48)).foregroundStyle(.tint); Text("CoreBlow").font(.title); Text("Version \(GatewayEnvironment.appVersion) (\(GatewayEnvironment.buildNumber))").font(.caption); Link("coreblow.com", destination: URL(string: "https://coreblow.com")!) }.padding(30) }
}
