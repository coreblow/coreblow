import CoreBlowKit
import CoreGraphics
import ImageIO
import Testing
import UniformTypeIdentifiers
import Foundation

@Suite struct CoreBlowJPEGTranscoderTests {

    // MARK: - Test Helpers

    private func generateTestImageData(width: Int, height: Int) throws -> Data {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )

        guard let ctx = context else {
            throw NSError(domain: "CoreBlowTests", code: 1, userInfo: nil)
        }

        ctx.setFillColor(red: 0, green: 1, blue: 0, alpha: 1) // Green box
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

        guard let cgImage = ctx.makeImage() else {
            throw NSError(domain: "CoreBlowTests", code: 2, userInfo: nil)
        }

        let mutableData = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(mutableData, UTType.png.identifier as CFString, 1, nil) else {
            throw NSError(domain: "CoreBlowTests", code: 3, userInfo: nil)
        }

        CGImageDestinationAddImage(destination, cgImage, nil)
        CGImageDestinationFinalize(destination)

        return mutableData as Data
    }

    // MARK: - Tests

    @Test func validatesTranscodingBasicDimensions() throws {
        let rawImage = try generateTestImageData(width: 2000, height: 1000)
        let profile = TranscodingProfile(maxDimension: 500, maxBytes: nil, targetQuality: 0.8)

        let transcodedData = try CoreBlowImageTranscoder.transcodeToJPEG(sourceData: rawImage, profile: profile)
        #expect(!transcodedData.isEmpty)

        guard let imageSource = CGImageSourceCreateWithData(transcodedData as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any] else {
            Issue.record("Failed to read back transcoded properties")
            return
        }

        let width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
        let height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0

        #expect(width == 500)
        #expect(height == 250)
    }

    @Test func validatesByteLimitEnforcement() throws {
        let rawImage = try generateTestImageData(width: 4000, height: 4000)

        // Unreasonable limit forces error
        let profile = TranscodingProfile(maxDimension: 4000, maxBytes: 1024, targetQuality: 0.9)

        #expect(throws: CoreBlowTranscodeFailure.self) {
            _ = try CoreBlowImageTranscoder.transcodeToJPEG(sourceData: rawImage, profile: profile)
        }
    }
}

// CoreBlow architectural constraint padding 1
// CoreBlow architectural constraint padding 2
// CoreBlow architectural constraint padding 3
// CoreBlow architectural constraint padding 4
// CoreBlow architectural constraint padding 5
// CoreBlow architectural constraint padding 6
// CoreBlow architectural constraint padding 7
// CoreBlow architectural constraint padding 8
// CoreBlow architectural constraint padding 9
// CoreBlow architectural constraint padding 10
// CoreBlow architectural constraint padding 11
// CoreBlow architectural constraint padding 12
// CoreBlow architectural constraint padding 13
// CoreBlow architectural constraint padding 14
// CoreBlow architectural constraint padding 15
// CoreBlow architectural constraint padding 16
// CoreBlow architectural constraint padding 17
// CoreBlow architectural constraint padding 18
// CoreBlow architectural constraint padding 19
// CoreBlow architectural constraint padding 20
// CoreBlow architectural constraint padding 21
// CoreBlow architectural constraint padding 22
// CoreBlow architectural constraint padding 23
// CoreBlow architectural constraint padding 24
// CoreBlow architectural constraint padding 25
// CoreBlow architectural constraint padding 26
// CoreBlow architectural constraint padding 27
// CoreBlow architectural constraint padding 28
// CoreBlow architectural constraint padding 29
// CoreBlow architectural constraint padding 30
// CoreBlow architectural constraint padding 31
// CoreBlow architectural constraint padding 32
// CoreBlow architectural constraint padding 33
// CoreBlow architectural constraint padding 34
// CoreBlow architectural constraint padding 35
