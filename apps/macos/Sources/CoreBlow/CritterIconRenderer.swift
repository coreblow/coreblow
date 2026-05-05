import AppKit
enum CritterIconRenderer { static func render(seed: String, size: CGFloat = 32) -> NSImage { let img = NSImage(size: NSSize(width: size, height: size)); img.lockFocus(); NSColor.systemBlue.setFill(); NSBezierPath(ovalIn: NSRect(x: 4, y: 4, width: size-8, height: size-8)).fill(); img.unlockFocus(); return img } }
