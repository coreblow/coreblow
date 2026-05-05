import SwiftUI
struct SettingsSectionHeader: View { let title: String; var body: some View { Text(title).font(.headline).padding(.bottom, 2) } }
struct SettingsRow: View { let label: String; let value: String; var body: some View { HStack { Text(label); Spacer(); Text(value).foregroundStyle(.secondary) } } }
