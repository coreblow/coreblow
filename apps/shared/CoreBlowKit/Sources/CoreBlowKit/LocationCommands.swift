import CoreLocation; import Foundation
public enum LocationCommands { public static func currentLocation() async throws -> CLLocation { try await LocationCurrentRequest().request() } }
