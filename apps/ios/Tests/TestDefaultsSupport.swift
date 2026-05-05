import Foundation

/// Shared test utilities for UserDefaults isolation.
enum TestDefaultsSupport {
    static func makeIsolatedDefaults() -> UserDefaults {
        let suiteName = "ai.coreblow.tests.\(UUID().uuidString)"
        return UserDefaults(suiteName: suiteName)!
    }

    static func cleanup(_ defaults: UserDefaults) {
        defaults.removePersistentDomain(forName: defaults.suiteName ?? "")
    }
}

private extension UserDefaults {
    var suiteName: String? {
        (self as AnyObject).value(forKey: "suiteName") as? String
    }
}
