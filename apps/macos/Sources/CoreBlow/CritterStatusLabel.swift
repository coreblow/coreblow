import SwiftUI
struct CritterStatusLabel: View { let name: String; let isOnline: Bool
    var body: some View { HStack(spacing: 4) { Circle().fill(isOnline ? .green : .gray).frame(width: 6, height: 6); Text(name).lineLimit(1) } }
}
