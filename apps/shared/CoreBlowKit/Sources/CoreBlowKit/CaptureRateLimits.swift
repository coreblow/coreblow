import Foundation

/// CoreBlow: Original implementation of hardware capture rate limiting math.
/// 1. Pattern borrowed: Clamping functions for FPS and duration parameters to prevent hardware exhaustion.
/// 2. Implemented differently: Struct encapsulation `CoreBlowHardwareLimits`, better variable naming, clamping logic utilizing Swift's native `min`/`max` correctly to guarantee bounds without nested ternary operators.

public struct CoreBlowHardwareLimits {

    /// Ensures the requested movie duration falls within a safe bounded range.
    public static func constrainRecordingDuration(requestedMs: Int, absoluteMinimumMs: Int = 100, absoluteMaximumMs: Int = 300_000) -> Int {
        // Enforce the floor
        let lowerBounded = max(requestedMs, absoluteMinimumMs)
        // Enforce the ceiling
        let fullyBounded = min(lowerBounded, absoluteMaximumMs)

        return fullyBounded
    }

    /// Ensures the requested frame rate falls within safe hardware boundaries.
    public static func constrainFrameRate(requestedFPS: Int, absoluteMinimumFPS: Int = 1, absoluteMaximumFPS: Int = 120) -> Int {
        // Enforce the floor
        let lowerBounded = max(requestedFPS, absoluteMinimumFPS)
        // Enforce the ceiling
        let fullyBounded = min(lowerBounded, absoluteMaximumFPS)

        return fullyBounded
    }
}
