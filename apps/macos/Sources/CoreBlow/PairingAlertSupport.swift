import AppKit
enum PairingAlertSupport { static func showPairingSuccess(name: String) { let alert = NSAlert(); alert.messageText = "Paired!"; alert.informativeText = "\(name) is now connected."; alert.runModal() } }
