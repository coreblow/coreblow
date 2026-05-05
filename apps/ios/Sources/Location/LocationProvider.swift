import Foundation
import CoreLocation

/// Provides single-shot and streaming location access for gateway invoke commands.
///
/// Pattern: @MainActor final class with CLLocationManagerDelegate
/// and CheckedContinuation bridging (mirrors OC's LocationService).
@MainActor
final class LocationProvider: NSObject, CLLocationManagerDelegate {

    enum LocationError: Error, LocalizedError {
        case servicesDisabled
        case permissionDenied
        case locationUnavailable
        case timeout

        var errorDescription: String? {
            switch self {
            case .servicesDisabled: return "Location services are disabled"
            case .permissionDenied: return "Location permission denied"
            case .locationUnavailable: return "Unable to determine location"
            case .timeout: return "Location request timed out"
            }
        }
    }

    private let manager = CLLocationManager()
    private var oneShotContinuation: CheckedContinuation<CLLocation, Error>?
    private var authContinuation: CheckedContinuation<CLAuthorizationStatus, Never>?
    private var streamContinuation: AsyncStream<CLLocation>.Continuation?
    private var isStreamingUpdates = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    // MARK: - Authorization

    func requestAuthorization(always: Bool = false) async -> CLAuthorizationStatus {
        let current = manager.authorizationStatus
        guard current == .notDetermined else { return current }

        if always {
            manager.requestAlwaysAuthorization()
        } else {
            manager.requestWhenInUseAuthorization()
        }

        return await withCheckedContinuation { continuation in
            self.authContinuation = continuation
        }
    }

    // MARK: - One-Shot

    func currentLocation(timeoutMs: Int = 10_000) async throws -> CLLocation {
        guard CLLocationManager.locationServicesEnabled() else {
            throw LocationError.servicesDisabled
        }

        let status = manager.authorizationStatus
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            throw LocationError.permissionDenied
        }

        return try await withThrowingTaskGroup(of: CLLocation.self) { group in
            group.addTask { @MainActor in
                try await withCheckedThrowingContinuation { continuation in
                    self.oneShotContinuation = continuation
                    self.manager.requestLocation()
                }
            }

            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)
                throw LocationError.timeout
            }

            guard let result = try await group.next() else {
                throw LocationError.locationUnavailable
            }
            group.cancelAll()
            return result
        }
    }

    // MARK: - Streaming

    func startUpdates(significantOnly: Bool = false) -> AsyncStream<CLLocation> {
        stopUpdates()
        isStreamingUpdates = true

        if significantOnly {
            manager.startMonitoringSignificantLocationChanges()
        } else {
            manager.startUpdatingLocation()
        }

        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            self.streamContinuation = continuation
            continuation.onTermination = { @Sendable _ in
                Task { @MainActor in self.stopUpdates() }
            }
        }
    }

    func stopUpdates() {
        guard isStreamingUpdates else { return }
        isStreamingUpdates = false
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
        streamContinuation?.finish()
        streamContinuation = nil
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            authContinuation?.resume(returning: status)
            authContinuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let locs = locations
        Task { @MainActor in
            if let cont = oneShotContinuation, let loc = locs.last {
                oneShotContinuation = nil
                cont.resume(returning: loc)
            }
            if let latest = locs.last {
                streamContinuation?.yield(latest)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let err = error
        Task { @MainActor in
            if let cont = oneShotContinuation {
                oneShotContinuation = nil
                cont.resume(throwing: err)
            }
        }
    }
}
