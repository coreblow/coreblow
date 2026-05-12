import AppKit
import OSLog
import CoreBlowKit
import OSLog
import Foundation
import CoreBlowKit
import ScreenCaptureKit

enum MacNodeScreenCommands {
    static func captureScreen(screenIndex: Int = 0) async throws -> Data {
        let content = try await SCShareableContent.current
        let displays = content.displays
        guard screenIndex < displays.count else {
            throw NSError(
                domain: "Screen", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Invalid screen index"])
        }
        let display = displays[screenIndex]
        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.width = Int(display.width)
        config.height = Int(display.height)
        config.pixelFormat = kCVPixelFormatType_32BGRA
        let image = try await SCScreenshotManager.captureImage(
            contentFilter: filter, configuration: config)
        let rep = NSBitmapImageRep(cgImage: image)
        guard let png = rep.representation(using: .png, properties: [:]) else {
            throw NSError(
                domain: "Screen", code: 3,
                userInfo: [NSLocalizedDescriptionKey: "PNG encoding failed"])
        }
        return png
    }
}
