import CoreLocation; import Foundation
public final class LocationCurrentRequest: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    private let manager = CLLocationManager(); private var continuation: CheckedContinuation<CLLocation, Error>?
    public override init() { super.init(); manager.delegate = self }
    public func request() async throws -> CLLocation { try await withCheckedThrowingContinuation { cont in continuation = cont; manager.requestLocation() } }
    public func locationManager(_ m: CLLocationManager, didUpdateLocations l: [CLLocation]) { continuation?.resume(returning: l.last ?? CLLocation()); continuation = nil }
    public func locationManager(_ m: CLLocationManager, didFailWithError e: Error) { continuation?.resume(throwing: e); continuation = nil }
}
