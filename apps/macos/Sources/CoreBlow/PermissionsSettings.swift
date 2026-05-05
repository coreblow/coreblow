import SwiftUI
struct PermissionsSettings: View {
    var body: some View { Form { ForEach(Capability.allCases, id: \.self) { cap in HStack { Text(cap.rawValue); Spacer(); Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) } } }.formStyle(.grouped) }
}
