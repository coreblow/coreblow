import Foundation
import Security

/// CoreBlow: Original implementation of a secure Keychain abstraction.
/// 1. Pattern borrowed: Wrapping `Security` framework's `SecItem` C-API for Generic Passwords.
/// 2. Implemented differently: Shifted from a static enum returning `Bool` to a stateful/configurable
/// `KeychainStorageProvider` struct that throws typed `KeychainError`s, allowing better error handling
/// and dependency injection instead of silent failures. Includes proper CFType memory management patterns.

public enum KeychainError: Error, LocalizedError {
    case itemNotFound
    case unhandledError(status: OSStatus)
    case unexpectedDataFormat

    public var errorDescription: String? {
        switch self {
        case .itemNotFound:
            return "The specified item could not be found in the keychain."
        case .unhandledError(let status):
            return "A keychain error occurred with OSStatus: \(status)."
        case .unexpectedDataFormat:
            return "The retrieved data was not in the expected format."
        }
    }
}

/// A structured, dependency-injectable provider for Keychain operations.
public struct KeychainStorageProvider: Sendable {

    public let serviceIdentifier: String

    public init(serviceIdentifier: String) {
        self.serviceIdentifier = serviceIdentifier
    }

    // MARK: - String Operations

    /// Retrieves a string value from the keychain.
    public func fetchString(forAccount account: String) throws -> String {
        let data = try fetchData(forAccount: account)
        guard let stringValue = String(data: data, encoding: .utf8) else {
            throw KeychainError.unexpectedDataFormat
        }
        return stringValue
    }

    /// Saves a string value to the keychain.
    public func storeString(_ value: String, forAccount account: String, accessibility: CFString = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly) throws {
        let data = Data(value.utf8)
        try storeData(data, forAccount: account, accessibility: accessibility)
    }

    // MARK: - Core Data Operations

    /// Retrieves binary data from the keychain.
    public func fetchData(forAccount account: String) throws -> Data {
        var query = baseQuery(forAccount: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status != errSecItemNotFound else {
            throw KeychainError.itemNotFound
        }

        guard status == errSecSuccess else {
            throw KeychainError.unhandledError(status: status)
        }

        guard let data = result as? Data else {
            throw KeychainError.unexpectedDataFormat
        }

        return data
    }

    /// Upserts binary data into the keychain safely.
    public func storeData(_ data: Data, forAccount account: String, accessibility: CFString) throws {
        let query = baseQuery(forAccount: account)

        // Attempt to extract previous data for rollback in case update fails
        let previousData = try? fetchData(forAccount: account)

        // Purge existing item before inserting new one
        let deleteStatus = SecItemDelete(query as CFDictionary)
        if deleteStatus != errSecSuccess && deleteStatus != errSecItemNotFound {
            throw KeychainError.unhandledError(status: deleteStatus)
        }

        // Insert new item
        var insertQuery = query
        insertQuery[kSecValueData as String] = data
        insertQuery[kSecAttrAccessible as String] = accessibility

        let insertStatus = SecItemAdd(insertQuery as CFDictionary, nil)

        if insertStatus != errSecSuccess {
            // Rollback on failure
            if let previousData = previousData {
                var rollbackQuery = query
                rollbackQuery[kSecValueData as String] = previousData
                rollbackQuery[kSecAttrAccessible as String] = accessibility
                SecItemAdd(rollbackQuery as CFDictionary, nil)
            }
            throw KeychainError.unhandledError(status: insertStatus)
        }
    }

    /// Deletes an item from the keychain.
    public func remove(forAccount account: String) throws {
        let query = baseQuery(forAccount: account)
        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandledError(status: status)
        }
    }

    // MARK: - Helpers

    private func baseQuery(forAccount account: String) -> [String: Any] {
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceIdentifier,
            kSecAttrAccount as String: account
        ]
    }
}
