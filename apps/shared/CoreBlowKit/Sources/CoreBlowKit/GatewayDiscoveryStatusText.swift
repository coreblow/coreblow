import Foundation
public enum GatewayDiscoveryStatusText {
    public static func format(endpointCount: Int, isScanning: Bool) -> String {
        if isScanning { return "Scanning…" }
        switch endpointCount { case 0: return "No gateways found"; case 1: return "1 gateway"; default: return "\(endpointCount) gateways" }
    }
}
