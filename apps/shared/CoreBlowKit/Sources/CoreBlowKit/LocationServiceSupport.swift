import CoreLocation
public enum LocationServiceSupport { public static var isAuthorized: Bool { CLLocationManager().authorizationStatus == .authorizedAlways || CLLocationManager().authorizationStatus == .authorized } }
