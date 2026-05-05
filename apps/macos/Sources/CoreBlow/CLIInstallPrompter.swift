import AppKit
enum CLIInstallPrompter { static func promptInstall() { let alert = NSAlert(); alert.messageText = "Install CLI?"; alert.informativeText = "Install coreblow-mac to /usr/local/bin?"; alert.addButton(withTitle: "Install"); alert.addButton(withTitle: "Cancel"); if alert.runModal() == .alertFirstButtonReturn { CLIInstaller.install() } } }
