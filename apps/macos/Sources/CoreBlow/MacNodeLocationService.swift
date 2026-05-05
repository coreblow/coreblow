import CoreLocation; import Foundation
final class MacNodeLocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager(); private var continuation: CheckedContinuation<CLLocation, Error>?
    override init() { super.init(); manager.delegate = self }
    func requestLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { cont in continuation = cont; manager.requestLocation() }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        continuation?.resume(returning: locations.last ?? CLLocation()); continuation = nil
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error); continuation = nil
    }
}
