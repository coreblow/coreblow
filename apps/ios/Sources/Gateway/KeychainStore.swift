import Foundation
import Security
import os.log

/// Secure token storage using the iOS Keychain.
final class KeychainStore {

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "Keychain")
    private let service = "ai.coreblow.gateway"

    /// Store a token for a gateway endpoint.
    func setToken(_ token: String, for endpointID: String) {
        guard let data = token.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: endpointID,
        ]

        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        if status == errSecSuccess {
            logger.info("Token stored for \(endpointID)")
        } else {
            logger.error("Token store failed: \(status)")
        }
    }

    /// Retrieve a token for a gateway endpoint.
    func getToken(for endpointID: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: endpointID,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Delete a token for a gateway endpoint.
    func deleteToken(for endpointID: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: endpointID,
        ]

        let status = SecItemDelete(query as CFDictionary)
        logger.info("Token deleted for \(endpointID): \(status == errSecSuccess ? "ok" : "not found")")
    }

    /// Delete all gateway tokens.
    func deleteAll() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(query as CFDictionary)
        logger.info("All gateway tokens deleted")
    }
}
