import SwiftUI
import OSLog
import CoreBlowKit

// MARK: - Sovereign Studio Settings Design System (Option 1 Zero-Fatigue Palette)

public struct StudioSettingsCard<Content: View>: View {
    @ViewBuilder public let content: () -> Content

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    public var body: some View {
        VStack(spacing: 0) {
            self.content()
        }
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.white.opacity(0.035))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

public struct StudioSettingsRow<Trailing: View>: View {
    public let title: String
    public let subtitle: String?
    @ViewBuilder public let trailing: () -> Trailing

    public init(title: String, subtitle: String? = nil, @ViewBuilder trailing: @escaping () -> Trailing) {
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text(self.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white)

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Color.white.opacity(0.52))
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: 12)

            self.trailing()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

public struct StudioToggleSwitch: View {
    @Binding public var isOn: Bool
    public var label: String? = nil

    public init(isOn: Binding<Bool>, label: String? = nil) {
        self._isOn = isOn
        self.label = label
    }

    public var body: some View {
        Toggle(isOn: self.$isOn) {
            if let label {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(.white)
            }
        }
        .toggleStyle(.switch)
        .tint(Color(red: 96/255.0, green: 217/255.0, blue: 204/255.0)) // Ice-Cyan
        .labelsHidden()
    }
}

public struct StudioSettingsCardHeader: View {
    public let title: String

    public init(_ title: String) {
        self.title = title
    }

    public var body: some View {
        Text(self.title.uppercased())
            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
            .foregroundStyle(Color.white.opacity(0.42))
            .padding(.leading, 2)
            .padding(.top, 8)
            .padding(.bottom, 2)
    }
}

public struct StudioSettingsDivider: View {
    public init() {}

    public var body: some View {
        Rectangle()
            .fill(Color.white.opacity(0.05))
            .frame(height: 0.5)
            .padding(.horizontal, 16)
    }
}

// MARK: - Legacy Backward Compatibility

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
