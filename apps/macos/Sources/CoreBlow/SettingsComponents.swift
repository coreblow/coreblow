import SwiftUI
import OSLog
import CoreBlowKit
import OSLog

struct SettingsToggleRow: View {
    let title: String
    let subtitle: String?
    @Binding var binding: Bool

    init(title: String, subtitle: String?, binding: Binding<Bool>) {
        self.title = title
        self.subtitle = subtitle
        self._binding = binding
    }

    init(title: String, subtitle: String?, isOn: Binding<Bool>) {
        self.init(title: title, subtitle: subtitle, binding: isOn)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: self.$binding) {
                Text(self.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white)
            }
            .toggleStyle(.checkbox)
            .tint(Color(red: 96/255.0, green: 217/255.0, blue: 204/255.0))

            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
