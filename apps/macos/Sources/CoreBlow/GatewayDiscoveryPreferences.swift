import Foundation
struct GatewayDiscoveryPreferences {
    var enableBonjour = true; var enableTailscale = true; var enableWideArea = false
    var customEndpoints: [String] = []
    static func load() -> GatewayDiscoveryPreferences {
        let d = UserDefaults.standard
        return GatewayDiscoveryPreferences(
            enableBonjour: d.object(forKey: "discovery.bonjour") != nil ? d.bool(forKey: "discovery.bonjour") : true,
            enableTailscale: d.object(forKey: "discovery.tailscale") != nil ? d.bool(forKey: "discovery.tailscale") : true,
            enableWideArea: d.bool(forKey: "discovery.wideArea"),
            customEndpoints: d.stringArray(forKey: "discovery.customEndpoints") ?? [])
    }
}
