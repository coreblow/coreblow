import CoreLocation
import Foundation

/// Pushes significant location change events to the gateway.
///
/// Pattern: caseless enum namespace (mirrors OC's SignificantLocationMonitor).
@MainActor
enum SignificantLocationRelay {

    struct LocationEvent: Codable {
        let latitude: Double
        let longitude: Double
        let accuracyMeters: Double
        let altitude: Double?
        let origin: String
        let timestampMs: Int64
    }

    /// Start relaying significant location changes to a gateway connection.
    ///
    /// - Parameters:
    ///   - provider: The location provider to listen for updates.
    ///   - connection: The gateway connection controller.
    ///   - requiresAlwaysAuth: If true, only starts if always-authorization is granted.
    static func startRelay(
        provider: LocationProvider,
        connection: GatewayConnectionController,
        requiresAlwaysAuth: Bool = true
    ) -> Task<Void, Never> {
        Task { @MainActor in
            if requiresAlwaysAuth {
                let status = CLLocationManager().authorizationStatus
                guard status == .authorizedAlways else { return }
            }

            let stream = provider.startUpdates(significantOnly: true)
            for await location in stream {
                let event = LocationEvent(
                    latitude: location.coordinate.latitude,
                    longitude: location.coordinate.longitude,
                    accuracyMeters: location.horizontalAccuracy,
                    altitude: location.altitude != 0 ? location.altitude : nil,
                    origin: "ios-significant-change",
                    timestampMs: Int64(location.timestamp.timeIntervalSince1970 * 1000)
                )

                guard let data = try? JSONEncoder().encode(event),
                      let jsonString = String(data: data, encoding: .utf8) else {
                    continue
                }

                try? await connection.sendInvoke(
                    command: "location.update",
                    params: ["payload": jsonString]
                )
            }
        }
    }
}
