import Foundation; import CryptoKit
public enum GatewayConnectChallengeSupport {
    public static func solve(challenge: String, secret: String) -> String {
        let key = SymmetricKey(data: Data(secret.utf8)); let mac = HMAC<SHA256>.authenticationCode(for: Data(challenge.utf8), using: key)
        return Data(mac).map { String(format: "%02x", $0) }.joined()
    }
}
