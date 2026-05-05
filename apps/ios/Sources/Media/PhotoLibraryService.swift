import Foundation
import Photos
#if canImport(UIKit)
import UIKit
#endif

/// Provides photo library access for gateway invoke commands.
final class PhotoLibraryService {
    private static let maxTotalBase64Chars = 340 * 1024
    private static let maxPerPhotoBase64Chars = 300 * 1024

    func latest(limit: Int?, maxWidth: Int?, quality: Double?) async throws -> CoreBlowPhotosPayload {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited else {
            throw NSError(domain: "Photos", code: 1, userInfo: [NSLocalizedDescriptionKey: "PHOTOS_PERMISSION_REQUIRED"])
        }
        let cap = max(1, min(limit ?? 1, 20))
        let opts = PHFetchOptions()
        opts.fetchLimit = cap
        opts.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        let assets = PHAsset.fetchAssets(with: .image, options: opts)
        var results: [CoreBlowPhotoPayload] = []
        var budget = Self.maxTotalBase64Chars
        let w = maxWidth ?? 1600
        let q = max(0.1, min(1.0, quality ?? 0.85))
        let fmt = ISO8601DateFormatter()
        #if canImport(UIKit)
        assets.enumerateObjects { asset, _, stop in
            if results.count >= cap { stop.pointee = true; return }
            if let p = Self.renderAsset(asset, maxWidth: w, quality: q, formatter: fmt) {
                if p.base64.count > budget { stop.pointee = true; return }
                budget -= p.base64.count
                results.append(p)
            }
        }
        #endif
        return CoreBlowPhotosPayload(photos: results)
    }

    #if canImport(UIKit)
    private static func renderAsset(_ asset: PHAsset, maxWidth: Int, quality: Double, formatter: ISO8601DateFormatter) -> CoreBlowPhotoPayload? {
        let mgr = PHImageManager.default()
        let opts = PHImageRequestOptions()
        opts.isSynchronous = true; opts.isNetworkAccessAllowed = true; opts.deliveryMode = .highQualityFormat
        let aspect = CGFloat(asset.pixelHeight) / CGFloat(max(1, asset.pixelWidth))
        let size = CGSize(width: CGFloat(maxWidth), height: CGFloat(maxWidth) * aspect)
        var img: UIImage?
        mgr.requestImage(for: asset, targetSize: size, contentMode: .aspectFit, options: opts) { r, _ in img = r }
        guard let image = img, let data = image.jpegData(compressionQuality: quality) else { return nil }
        let b64 = data.base64EncodedString()
        guard b64.count <= maxPerPhotoBase64Chars else { return nil }
        return CoreBlowPhotoPayload(format: "jpeg", base64: b64, width: Int(image.size.width),
            height: Int(image.size.height), createdAt: asset.creationDate.map { formatter.string(from: $0) })
    }
    #endif
}

struct CoreBlowPhotosPayload { let photos: [CoreBlowPhotoPayload] }
struct CoreBlowPhotoPayload { let format: String; let base64: String; let width: Int; let height: Int; let createdAt: String? }
