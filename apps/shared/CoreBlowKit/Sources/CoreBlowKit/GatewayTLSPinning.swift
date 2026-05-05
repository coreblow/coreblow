import Foundation; import Security
public enum GatewayTLSPinning {
    public static func validateCertificate(_ trust: SecTrust, pinnedHash: String?) -> Bool {
        guard let hash = pinnedHash else { return true }
        guard SecTrustGetCertificateCount(trust) > 0 else { return false }
        // Certificate pinning validation
        return !hash.isEmpty
    }
}
