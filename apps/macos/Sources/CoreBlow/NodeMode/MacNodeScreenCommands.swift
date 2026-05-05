import AppKit; import Foundation
enum MacNodeScreenCommands {
    static func captureScreen(screenIndex: Int = 0) async throws -> Data {
        let screens = NSScreen.screens; guard screenIndex < screens.count else { throw NSError(domain: "Screen", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid screen index"]) }
        let screen = screens[screenIndex]; let cgImage = CGWindowListCreateImage(screen.frame, .optionOnScreenOnly, kCGNullWindowID, .bestResolution)
        guard let image = cgImage else { throw NSError(domain: "Screen", code: 2, userInfo: [NSLocalizedDescriptionKey: "Screenshot failed"]) }
        let rep = NSBitmapImageRep(cgImage: image); guard let png = rep.representation(using: .png, properties: [:]) else { throw NSError(domain: "Screen", code: 3, userInfo: [NSLocalizedDescriptionKey: "PNG encoding failed"]) }
        return png
    }
}
