import Foundation
import OSLog
import CoreBlowKit
import OSLog
enum UserDefaultsMigration {
    private static let currentVersion = 2
    static func runIfNeeded() {
        let defaults = UserDefaults.standard
        let stored = defaults.integer(forKey: "coreblow.migrationVersion")
        guard stored < currentVersion else { return }
        if stored < 1 { migrateV0toV1(defaults) }
        if stored < 2 { migrateV1toV2(defaults) }
        defaults.set(currentVersion, forKey: "coreblow.migrationVersion")
    }
    private static func migrateV0toV1(_ defaults: UserDefaults) {
        if let old = defaults.string(forKey: "gatewayHost") { defaults.set(old, forKey: "gateway.host"); defaults.removeObject(forKey: "gatewayHost") }
        if defaults.object(forKey: "gatewayPort") != nil { defaults.set(defaults.integer(forKey: "gatewayPort"), forKey: "gateway.port"); defaults.removeObject(forKey: "gatewayPort") }
    }
    private static func migrateV1toV2(_ defaults: UserDefaults) {
        if defaults.object(forKey: "app.showInMenuBar") == nil { defaults.set(true, forKey: "app.showInMenuBar") }
    }
}
