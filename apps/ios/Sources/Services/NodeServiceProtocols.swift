import CoreLocation
import Foundation
import CoreBlowKit
import UIKit

typealias CoreBlowCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias CoreBlowCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: CoreBlowCameraSnapParams) async throws -> CoreBlowCameraSnapResult
    func clip(params: CoreBlowCameraClipParams) async throws -> CoreBlowCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: CoreBlowLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: CoreBlowLocationGetParams,
        desiredAccuracy: CoreBlowLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: CoreBlowLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> CoreBlowDeviceStatusPayload
    func info() -> CoreBlowDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: CoreBlowPhotosLatestParams) async throws -> CoreBlowPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: CoreBlowContactsSearchParams) async throws -> CoreBlowContactsSearchPayload
    func add(params: CoreBlowContactsAddParams) async throws -> CoreBlowContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: CoreBlowCalendarEventsParams) async throws -> CoreBlowCalendarEventsPayload
    func add(params: CoreBlowCalendarAddParams) async throws -> CoreBlowCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: CoreBlowRemindersListParams) async throws -> CoreBlowRemindersListPayload
    func add(params: CoreBlowRemindersAddParams) async throws -> CoreBlowRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: CoreBlowMotionActivityParams) async throws -> CoreBlowMotionActivityPayload
    func pedometer(params: CoreBlowPedometerParams) async throws -> CoreBlowPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: CoreBlowWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
