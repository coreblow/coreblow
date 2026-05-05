import CoreMotion
import Foundation

/// Provides motion activity and pedometer data for gateway invoke commands.
final class MotionService {

    func activities(startISO: String?, endISO: String?, limit: Int?) async throws -> CoreBlowMotionActivityPayload {
        guard CMMotionActivityManager.isActivityAvailable() else {
            throw NSError(domain: "Motion", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "MOTION_UNAVAILABLE: activity not supported on this device",
            ])
        }
        let auth = CMMotionActivityManager.authorizationStatus()
        guard auth == .authorized else {
            throw NSError(domain: "Motion", code: 3, userInfo: [
                NSLocalizedDescriptionKey: "MOTION_PERMISSION_REQUIRED: grant Motion & Fitness permission",
            ])
        }

        let (start, end) = Self.resolveRange(startISO: startISO, endISO: endISO)
        let cap = max(1, min(limit ?? 200, 1000))

        let manager = CMMotionActivityManager()
        let entries: [CoreBlowMotionActivityEntry] = try await withCheckedThrowingContinuation { cont in
            manager.queryActivityStarting(from: start, to: end, to: OperationQueue()) { activities, error in
                if let error {
                    cont.resume(throwing: error)
                } else {
                    let formatter = ISO8601DateFormatter()
                    let sliced = Array((activities ?? []).suffix(cap))
                    let mapped = sliced.map { entry in
                        CoreBlowMotionActivityEntry(
                            startISO: formatter.string(from: entry.startDate),
                            confidence: Self.confidenceLabel(entry.confidence),
                            isWalking: entry.walking,
                            isRunning: entry.running,
                            isCycling: entry.cycling,
                            isAutomotive: entry.automotive,
                            isStationary: entry.stationary,
                            isUnknown: entry.unknown)
                    }
                    cont.resume(returning: mapped)
                }
            }
        }
        return CoreBlowMotionActivityPayload(activities: entries)
    }

    func pedometer(startISO: String?, endISO: String?) async throws -> CoreBlowPedometerPayload {
        guard CMPedometer.isStepCountingAvailable() else {
            throw NSError(domain: "Motion", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "PEDOMETER_UNAVAILABLE: step counting not supported",
            ])
        }
        let auth = CMPedometer.authorizationStatus()
        guard auth == .authorized else {
            throw NSError(domain: "Motion", code: 4, userInfo: [
                NSLocalizedDescriptionKey: "MOTION_PERMISSION_REQUIRED: grant Motion & Fitness permission",
            ])
        }

        let (start, end) = Self.resolveRange(startISO: startISO, endISO: endISO)
        let ped = CMPedometer()
        let payload: CoreBlowPedometerPayload = try await withCheckedThrowingContinuation { cont in
            ped.queryPedometerData(from: start, to: end) { data, error in
                if let error {
                    cont.resume(throwing: error)
                } else {
                    let formatter = ISO8601DateFormatter()
                    cont.resume(returning: CoreBlowPedometerPayload(
                        startISO: formatter.string(from: start),
                        endISO: formatter.string(from: end),
                        steps: data?.numberOfSteps.intValue,
                        distanceMeters: data?.distance?.doubleValue,
                        floorsAscended: data?.floorsAscended?.intValue,
                        floorsDescended: data?.floorsDescended?.intValue))
                }
            }
        }
        return payload
    }

    private static func resolveRange(startISO: String?, endISO: String?) -> (Date, Date) {
        let formatter = ISO8601DateFormatter()
        let start = startISO.flatMap { formatter.date(from: $0) } ?? Calendar.current.startOfDay(for: Date())
        let end = endISO.flatMap { formatter.date(from: $0) } ?? Date()
        return (start, end)
    }

    private static func confidenceLabel(_ confidence: CMMotionActivityConfidence) -> String {
        switch confidence {
        case .low: "low"
        case .medium: "medium"
        case .high: "high"
        @unknown default: "unknown"
        }
    }
}

// MARK: - Payload Types

struct CoreBlowMotionActivityPayload { let activities: [CoreBlowMotionActivityEntry] }
struct CoreBlowMotionActivityEntry {
    let startISO: String; let confidence: String
    let isWalking: Bool; let isRunning: Bool; let isCycling: Bool
    let isAutomotive: Bool; let isStationary: Bool; let isUnknown: Bool
}
struct CoreBlowPedometerPayload {
    let startISO: String; let endISO: String
    let steps: Int?; let distanceMeters: Double?
    let floorsAscended: Int?; let floorsDescended: Int?
}
