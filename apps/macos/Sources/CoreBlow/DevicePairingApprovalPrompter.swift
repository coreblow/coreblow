import AppKit
enum DevicePairingApprovalPrompter { static func prompt(deviceName: String, deviceId: String) async -> Bool { await MainActor.run { let alert = NSAlert(); alert.messageText = "Pair Device?"; alert.informativeText = "\(deviceName) wants to connect."; alert.addButton(withTitle: "Allow"); alert.addButton(withTitle: "Deny"); return alert.runModal() == .alertFirstButtonReturn } } }
