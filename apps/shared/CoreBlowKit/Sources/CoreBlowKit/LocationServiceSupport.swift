import Foundation
import CoreLocation

@MainActor
public protocol LocationServiceCommon: AnyObject, CLLocationManagerDelegate {
    var locationManager: CLLocationManager { get }
    var locationRequestContinuation: CheckedContinuation<CLLocation, Error>? { get set }
}

public extension LocationServiceCommon {
    func configureLocationManager() {
        self.locationManager.delegate = self
        self.locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func authorizationStatus() -> CLAuthorizationStatus {
        self.locationManager.authorizationStatus
    }

    func accuracyAuthorization() -> CLAccuracyAuthorization {
        LocationServiceSupport.accuracyAuthorization(manager: self.locationManager)
    }

    func requestLocationOnce() async throws -> CLLocation {
        try await LocationServiceSupport.requestLocation(manager: self.locationManager) { continuation in
            self.locationRequestContinuation = continuation
        }
    }
}

public enum LocationServiceSupport {
    public static func accuracyAuthorization(manager: CLLocationManager) -> CLAccuracyAuthorization {
        if #available(iOS 14.0, macOS 11.0, *) {
            return manager.accuracyAuthorization
        }
        return .fullAccuracy
    }

    @MainActor
    public static func requestLocation(
        manager: CLLocationManager,
        setContinuation: @escaping (CheckedContinuation<CLLocation, Error>) -> Void) async throws -> CLLocation
    {
        try await withCheckedThrowingContinuation { continuation in
            setContinuation(continuation)
            manager.requestLocation()
        }
    }
}

/// CoreBlow: Device Location Services resolution helper.
/// Abstracts CLLocationManager interactions cleanly.
@MainActor
public final class CoreBlowLocationServiceSupport: NSObject, LocationServiceCommon, @unchecked Sendable {

    public let locationManager = CLLocationManager()
    public var locationRequestContinuation: CheckedContinuation<CLLocation, Error>?

    public override init() {
        super.init()
        self.configureLocationManager()
    }

    public func requestPermissions() {
        locationManager.requestWhenInUseAuthorization()
    }

    public func checkAuthorizationStatus() -> CLAuthorizationStatus {
        return self.authorizationStatus()
    }

    public func forceLocationUpdate() {
        locationManager.requestLocation()
    }

    // MARK: - CLLocationManagerDelegate

    public nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            guard let location = locations.last else { return }
            if let continuation = self.locationRequestContinuation {
                self.locationRequestContinuation = nil
                continuation.resume(returning: location)
            }
        }
    }

    public nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            if let continuation = self.locationRequestContinuation {
                self.locationRequestContinuation = nil
                continuation.resume(throwing: error)
            }
        }
    }
}
