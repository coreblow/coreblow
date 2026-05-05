import AppKit
enum ScreenshotSize { static func mainScreenSize() -> CGSize { NSScreen.main?.frame.size ?? CGSize(width: 1920, height: 1080) } }
