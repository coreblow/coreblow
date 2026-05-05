import SwiftUI
struct SettingsSidebarCard: View { let icon: String; let title: String; let isSelected: Bool
    var body: some View { HStack { Image(systemName: icon); Text(title) }.padding(6).background(isSelected ? Color.accentColor.opacity(0.15) : .clear, in: RoundedRectangle(cornerRadius: 6)) }
}
