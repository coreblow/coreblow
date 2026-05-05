import Foundation
public actor DeviceAuthStore {
    private let key = "coreblow.deviceAuth"; private var token: String?
    public init() {}
    public func save(_ authToken: String) { token = authToken; UserDefaults.standard.set(authToken, forKey: key) }
    public func load() -> String? { if token == nil { token = UserDefaults.standard.string(forKey: key) }; return token }
    public func clear() { token = nil; UserDefaults.standard.removeObject(forKey: key) }
}
