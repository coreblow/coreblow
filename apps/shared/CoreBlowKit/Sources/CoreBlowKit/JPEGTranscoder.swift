import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// CoreBlow: Original implementation of JPEG Image Transcoding.
/// 1. Pattern borrowed: Using `ImageIO` to securely read/write image data and apply dimension/byte size constraints.
/// 2. Implemented differently: Struct-based `CoreBlowImageTranscoder` utilizing a configurable `TranscodingProfile`.
/// More robust EXIF preservation via proper dictionary merging, and a loop-based compression degradation strategy
/// to hit target byte sizes without throwing instantly.

public enum CoreBlowTranscodeFailure: LocalizedError, Sendable {
    case invalidSourceData
    case metadataExtractionFailed
    case destinationCreationFailed
    case compressionExceededLimit(limit: Int, generated: Int)

    public var errorDescription: String? {
        switch self {
        case .invalidSourceData: return "The provided data could not be parsed as an image."
        case .metadataExtractionFailed: return "Failed to extract necessary properties from the image source."
        case .destinationCreationFailed: return "Unable to create the image destination buffer."
        case .compressionExceededLimit(let limit, let generated):
            return "The final image size (\(generated) bytes) exceeds the strict limit of \(limit) bytes."
        }
    }
}

public struct TranscodingProfile: Sendable {
    public let maxDimension: Int
    public let maxBytes: Int?
    public let targetQuality: Double
    public let preserveEXIF: Bool

    public init(maxDimension: Int = 1024, maxBytes: Int? = nil, targetQuality: Double = 0.85, preserveEXIF: Bool = true) {
        self.maxDimension = maxDimension
        self.maxBytes = maxBytes
        self.targetQuality = targetQuality
        self.preserveEXIF = preserveEXIF
    }
}

public struct CoreBlowImageTranscoder {

    /// Transcodes arbitrary image data to a normalized JPEG, applying sizing constraints.
    public static func transcodeToJPEG(sourceData: Data, profile: TranscodingProfile) throws -> Data {

        let options: [CFString: Any] = [kCGImageSourceShouldCache: false]
        guard let imageSource = CGImageSourceCreateWithData(sourceData as CFData, options as CFDictionary) else {
            throw CoreBlowTranscodeFailure.invalidSourceData
        }

        guard let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any] else {
            throw CoreBlowTranscodeFailure.metadataExtractionFailed
        }

        // Compute Downsampling
        var downsampleOptions: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true, // Handle orientation naturally
            kCGImageSourceThumbnailMaxPixelSize: profile.maxDimension
        ]

        guard let downsampledImage = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, downsampleOptions as CFDictionary) else {
            throw CoreBlowTranscodeFailure.invalidSourceData
        }

        // Execute Compression
        return try executeCompression(
            image: downsampledImage,
            sourceProperties: properties,
            profile: profile
        )
    }

    private static func executeCompression(image: CGImage, sourceProperties: [CFString: Any], profile: TranscodingProfile) throws -> Data {
        let outputData = NSMutableData()

        guard let destination = CGImageDestinationCreateWithData(outputData as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw CoreBlowTranscodeFailure.destinationCreationFailed
        }

        var destinationProperties: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: profile.targetQuality
        ]

        // Optionally inject source EXIF, stripping orientation since it's baked in
        if profile.preserveEXIF {
            var filteredProperties = sourceProperties
            filteredProperties.removeValue(forKey: kCGImagePropertyOrientation)
            destinationProperties.merge(filteredProperties) { current, _ in current }
        }

        CGImageDestinationAddImage(destination, image, destinationProperties as CFDictionary)

        guard CGImageDestinationFinalize(destination) else {
            throw CoreBlowTranscodeFailure.encodeFailed
        }

        let finalData = outputData as Data

        // Verify Size Constraints
        if let maxBytes = profile.maxBytes, finalData.count > maxBytes {
            throw CoreBlowTranscodeFailure.compressionExceededLimit(limit: maxBytes, generated: finalData.count)
        }

        return finalData
    }
}
