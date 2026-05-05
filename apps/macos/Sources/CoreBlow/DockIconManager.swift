import AppKit
enum DockIconManager { static func setVisible(_ visible: Bool) { NSApp.setActivationPolicy(visible ? .regular : .accessory) } }
