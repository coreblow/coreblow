import Foundation
public enum CaptureRateLimits {
    public static let screenshotMinInterval: TimeInterval = 0.5; public static let cameraMinInterval: TimeInterval = 1.0
    public static let maxConcurrentCaptures = 3
    public static func shouldThrottle(lastCapture: Date?, minInterval: TimeInterval) -> Bool {
        guard let last = lastCapture else { return false }; return Date().timeIntervalSince(last) < minInterval
    }
}
