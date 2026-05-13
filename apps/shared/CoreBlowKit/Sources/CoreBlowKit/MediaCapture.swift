// CoreBlowKit/Features/MediaCapture.swift
// Media capture abstractions (camera, screen, photos).
// Platform-independent interface — implementations injected per platform.

import Foundation
import CoreBlowProtocol

// MARK: - Capture Rate Limits

/// Rate limiting for media capture streams.
public struct CaptureRateLimits: Sendable {
    public let maxFPS: Double
    public let minIntervalMs: Double
    public let maxQueueDepth: Int

    public init(maxFPS: Double = 10, minIntervalMs: Double = 100, maxQueueDepth: Int = 3) {
        self.maxFPS = maxFPS
        self.minIntervalMs = minIntervalMs
        self.maxQueueDepth = maxQueueDepth
    }

    /// Default capture limits.
    public static let `default` = CaptureRateLimits()

    /// High-quality capture limits (lower FPS, higher quality).
    public static let highQuality = CaptureRateLimits(maxFPS: 5, minIntervalMs: 200, maxQueueDepth: 2)

    public static func clampDurationMs(
        _ ms: Int?,
        defaultMs: Int = 10_000,
        minMs: Int = 250,
        maxMs: Int = 60_000
    ) -> Int {
        let value = ms ?? defaultMs
        return min(maxMs, max(minMs, value))
    }

    public static func clampFps(
        _ fps: Double?,
        defaultFps: Double = 10,
        minFps: Double = 1,
        maxFps: Double
    ) -> Double {
        let value = fps ?? defaultFps
        guard value.isFinite else { return defaultFps }
        return min(maxFps, max(minFps, value))
    }
}

// MARK: - Camera Configuration

/// Camera session configuration.
public struct CameraSessionConfig: Sendable, Codable {
    public let resolution: String
    public let quality: String
    public let lens: String?
    public let flashMode: String?
    public let continuousAutoFocus: Bool

    public init(resolution: String = "1280x720", quality: String = "high",
                lens: String? = nil, flashMode: String? = nil,
                continuousAutoFocus: Bool = true) {
        self.resolution = resolution; self.quality = quality
        self.lens = lens; self.flashMode = flashMode
        self.continuousAutoFocus = continuousAutoFocus
    }
}

// MARK: - JPEG Transcoding

/// JPEG transcoding parameters.
public struct JPEGTranscodeParams: Sendable {
    public let quality: CGFloat
    public let maxDimension: CGFloat?

    public init(quality: CGFloat = 0.8, maxDimension: CGFloat? = 1920) {
        self.quality = quality; self.maxDimension = maxDimension
    }

    /// Default for streaming (lower quality, smaller size).
    public static let streaming = JPEGTranscodeParams(quality: 0.6, maxDimension: 1280)

    /// Default for capture (high quality).
    public static let capture = JPEGTranscodeParams(quality: 0.85, maxDimension: 2560)
}

// MARK: - Photo Capture Result

/// Result from a photo capture operation.
public struct PhotoCaptureResult: Sendable {
    public let data: Data
    public let mimeType: String
    public let width: Int
    public let height: Int
    public let metadata: [String: FlexValue]?

    public init(data: Data, mimeType: String = "image/jpeg",
                width: Int, height: Int, metadata: [String: FlexValue]? = nil) {
        self.data = data; self.mimeType = mimeType
        self.width = width; self.height = height; self.metadata = metadata
    }

    /// Base64-encoded content for transmission.
    public var base64Content: String {
        data.base64EncodedString()
    }
}

// MARK: - Location Request

/// Location request configuration.
public struct LocationRequest: Sendable, Codable {
    public let accuracy: String
    public let timeout: Int?
    public let includeAddress: Bool

    public init(accuracy: String = "best", timeout: Int? = 10_000, includeAddress: Bool = false) {
        self.accuracy = accuracy; self.timeout = timeout; self.includeAddress = includeAddress
    }
}

/// Location result.
public struct LocationResult: Sendable, Codable {
    public let latitude: Double
    public let longitude: Double
    public let altitude: Double?
    public let accuracy: Double?
    public let speed: Double?
    public let heading: Double?
    public let address: String?
    public let timestamp: Double

    public init(latitude: Double, longitude: Double, altitude: Double? = nil,
                accuracy: Double? = nil, speed: Double? = nil, heading: Double? = nil,
                address: String? = nil, timestamp: Double = Date().timeIntervalSince1970) {
        self.latitude = latitude; self.longitude = longitude; self.altitude = altitude
        self.accuracy = accuracy; self.speed = speed; self.heading = heading
        self.address = address; self.timestamp = timestamp
    }
}

// MARK: - Date Range Parameters

/// Date range limit parameters for calendar/reminders queries.
public struct DateRangeParams: Sendable, Codable {
    public let startDate: String?
    public let endDate: String?
    public let limit: Int?

    public init(startDate: String? = nil, endDate: String? = nil, limit: Int? = nil) {
        self.startDate = startDate; self.endDate = endDate; self.limit = limit
    }
}
