import CoreLocation
import Foundation

/// Monitors significant location changes and pushes `location.update`
/// events to the gateway for geofencing and work-location awareness.
@MainActor
enum SignificantLocationMonitor {

    static func startIfNeeded(
        locationService: LocationService,
        requireAlwaysAuth: Bool = true,
        gateway: GatewayConnectionController,
        beforeSend: (@MainActor @Sendable () async -> Void)? = nil
    ) {
        if requireAlwaysAuth {
            let status = locationService.locationManager.authorizationStatus
            guard status == .authorizedAlways else { return }
        }

        locationService.startMonitoringSignificantLocationChanges { location in
            struct Payload: Codable {
                var lat: Double
                var lon: Double
                var accuracyMeters: Double
                var source: String?
            }

            let payload = Payload(
                lat: location.coordinate.latitude,
                lon: location.coordinate.longitude,
                accuracyMeters: location.horizontalAccuracy,
                source: "ios-significant-location")

            guard let data = try? JSONEncoder().encode(payload),
                  let json = String(data: data, encoding: .utf8)
            else { return }

            Task { @MainActor in
                if let beforeSend {
                    await beforeSend()
                }
                try? await gateway.sendInvoke(
                    command: "location.update",
                    params: ["payloadJSON": json])
            }
        }
    }
}
