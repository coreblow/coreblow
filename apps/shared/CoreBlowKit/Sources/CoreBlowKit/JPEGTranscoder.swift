import Foundation
#if canImport(AppKit)
import AppKit
public enum JPEGTranscoder {
    public static func transcode(pngData: Data, quality: Double = 0.85, maxWidth: Int? = nil) -> Data? {
        guard let image = NSImage(data: pngData), let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        var targetImage = cgImage
        if let maxW = maxWidth, cgImage.width > maxW { let scale = Double(maxW) / Double(cgImage.width); let newH = Int(Double(cgImage.height) * scale)
            if let ctx = CGContext(data: nil, width: maxW, height: newH, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) { ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: maxW, height: newH)); targetImage = ctx.makeImage() ?? cgImage } }
        let rep = NSBitmapImageRep(cgImage: targetImage); return rep.representation(using: .jpeg, properties: [.compressionFactor: quality])
    }
}
#endif
