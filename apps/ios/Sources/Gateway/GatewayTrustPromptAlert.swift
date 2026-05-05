import SwiftUI

/// Alert shown when an untrusted gateway requests connection.
struct GatewayTrustPromptAlert: View {
    let endpoint: GatewayConnectConfig
    let onTrust: () -> Void
    let onReject: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.shield")
                .font(.system(size: 48))
                .foregroundStyle(.orange)

            Text("Trust This Gateway?")
                .font(.headline)

            Text("A gateway at **\(endpoint.label)** is requesting to pair with this device.")
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                InfoRow(label: "Host", value: endpoint.host)
                InfoRow(label: "Port", value: "\(endpoint.port)")
                InfoRow(label: "TLS", value: endpoint.useTLS ? "Enabled" : "Disabled")
                InfoRow(label: "Source", value: endpoint.source.rawValue)
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))

            HStack(spacing: 16) {
                Button("Reject", role: .destructive) { onReject() }
                    .buttonStyle(.bordered)
                Button("Trust & Connect") { onTrust() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
    }
}

private struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary).frame(width: 60, alignment: .leading)
            Text(value).font(.caption).fontDesign(.monospaced)
        }
    }
}
