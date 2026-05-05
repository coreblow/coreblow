import Foundation
enum PlatformLabelFormatter { static func format(platform: String) -> String { switch platform.lowercased() { case "macos": "macOS"; case "ios": "iOS"; case "android": "Android"; case "linux": "Linux"; case "windows": "Windows"; default: platform } } }
