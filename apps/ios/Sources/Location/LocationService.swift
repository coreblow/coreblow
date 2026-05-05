import CoreLocation
import Foundation

/// Provides single-shot and streaming location for gateway invoke commands.
@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {

    enum Error: Swift.Error {
        case timeout
        case unavailable
    }

    private let manager = CLLocationManager()
    private var authContinuation: CheckedContinuation<CLAuthorizationStatus, Never>?
    private var locationContinuation: CheckedContinuation<CLLocation, Swift.Error>?
    private var updatesContinuation: AsyncStream<CLLocation>.Continuation?
    private var isStreaming = false
    private var significantLocationCallback: (@Sendable (CLLocation) -> Void)?
    private var isMonitoringSignificantChanges = false

    var locationManager: CLLocationManager {
        manager
    }

    var locationRequestContinuation: CheckedContinuation<CLLocation, Swift.Error>? {
        get { locationContinuation }
        set { locationContinuation = newValue }
    }

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func ensureAuthorization(always: Bool = false) async -> CLAuthorizationStatus {
        guard CLLocationManager.locationServicesEnabled() else { return .denied }

        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
            let updated = await awaitAuthorizationChange()
            if !always { return updated }
        }

        if always {
            let current = manager.authorizationStatus
            if current == .authorizedWhenInUse {
                manager.requestAlwaysAuthorization()
                return await awaitAuthorizationChange()
            }
            return current
        }

        return manager.authorizationStatus
    }

    func currentLocation(timeoutMs: Int = 10_000) async throws -> CLLocation {
        try await withThrowingTaskGroup(of: CLLocation.self) { group in
            group.addTask { @MainActor in
                try await withCheckedThrowingContinuation { continuation in
                    self.locationContinuation = continuation
                    self.manager.requestLocation()
                }
            }

            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)
                throw Error.timeout
            }

            guard let result = try await group.next() else {
                throw Error.unavailable
            }
            group.cancelAll()
            return result
        }
    }

    private func awaitAuthorizationChange() async -> CLAuthorizationStatus {
        await withCheckedContinuation { cont in
            authContinuation = cont
        }
    }

    func startLocationUpdates(significantChangesOnly: Bool = false) -> AsyncStream<CLLocation> {
        stopLocationUpdates()
        isStreaming = true

        manager.pausesLocationUpdatesAutomatically = true
        if significantChangesOnly {
            manager.startMonitoringSignificantLocationChanges()
        } else {
            manager.startUpdatingLocation()
        }

        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            updatesContinuation = continuation
            continuation.onTermination = { @Sendable _ in
                Task { @MainActor in self.stopLocationUpdates() }
            }
        }
    }

    func stopLocationUpdates() {
        guard isStreaming else { return }
        isStreaming = false
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
        updatesContinuation?.finish()
        updatesContinuation = nil
    }

    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void) {
        significantLocationCallback = onUpdate
        guard !isMonitoringSignificantChanges else { return }
        isMonitoringSignificantChanges = true
        manager.startMonitoringSignificantLocationChanges()
    }

    func stopMonitoringSignificantLocationChanges() {
        guard isMonitoringSignificantChanges else { return }
        isMonitoringSignificantChanges = false
        significantLocationCallback = nil
        manager.stopMonitoringSignificantLocationChanges()
    }

    // MARK: - CLLocationManagerDelegate

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            if let cont = authContinuation {
                authContinuation = nil
                cont.resume(returning: status)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let locs = locations
        Task { @MainActor in
            if let cont = locationContinuation {
                locationContinuation = nil
                if let latest = locs.last {
                    cont.resume(returning: latest)
                } else {
                    cont.resume(throwing: Error.unavailable)
                }
            }
            if let callback = significantLocationCallback, let latest = locs.last {
                callback(latest)
            }
            if let latest = locs.last, let updates = updatesContinuation {
                updates.yield(latest)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Swift.Error) {
        let err = error
        Task { @MainActor in
            guard let cont = locationContinuation else { return }
            locationContinuation = nil
            cont.resume(throwing: err)
        }
    }
}
