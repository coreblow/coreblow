import Foundation
import Security

public enum GenericPasswordKeychainStore {
    private final class TestFallbackStore: @unchecked Sendable {
        private let lock = NSLock()
        private var values: [String: String] = [:]

        func load(service: String, account: String) -> String? {
            self.lock.lock()
            defer { self.lock.unlock() }
            return self.values[self.key(service: service, account: account)]
        }

        func save(_ value: String, service: String, account: String) {
            self.lock.lock()
            defer { self.lock.unlock() }
            self.values[self.key(service: service, account: account)] = value
        }

        func delete(service: String, account: String) {
            self.lock.lock()
            defer { self.lock.unlock() }
            self.values.removeValue(forKey: self.key(service: service, account: account))
        }

        private func key(service: String, account: String) -> String {
            "\(service)\u{1f}\(account)"
        }
    }

    private static let testFallbackStore = TestFallbackStore()

    public static func loadString(service: String, account: String) -> String? {
        if let data = self.loadData(service: service, account: account) {
            return String(data: data, encoding: .utf8)
        }
        guard self.isRunningUnderXCTest else { return nil }
        return self.testFallbackStore.load(service: service, account: account)
    }

    @discardableResult
    public static func saveString(
        _ value: String,
        service: String,
        account: String,
        accessible: CFString = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    ) -> Bool {
        if self.saveData(Data(value.utf8), service: service, account: account, accessible: accessible) {
            self.testFallbackStore.delete(service: service, account: account)
            return true
        }
        guard self.isRunningUnderXCTest else { return false }
        self.testFallbackStore.save(value, service: service, account: account)
        return true
    }

    @discardableResult
    public static func delete(service: String, account: String) -> Bool {
        let query = self.baseQuery(service: service, account: account)
        let status = SecItemDelete(query as CFDictionary)
        self.testFallbackStore.delete(service: service, account: account)
        if status == errSecSuccess || status == errSecItemNotFound {
            return true
        }
        return self.isRunningUnderXCTest
    }

    private static func loadData(service: String, account: String) -> Data? {
        var query = self.baseQuery(service: service, account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return data
    }

    @discardableResult
    private static func saveData(
        _ data: Data,
        service: String,
        account: String,
        accessible: CFString
    ) -> Bool {
        let query = self.baseQuery(service: service, account: account)
        let previousData = self.loadData(service: service, account: account)

        let deleteStatus = SecItemDelete(query as CFDictionary)
        guard deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound else {
            return false
        }

        var insert = query
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = accessible
        if SecItemAdd(insert as CFDictionary, nil) == errSecSuccess {
            return true
        }

        guard let previousData else { return false }
        var rollback = query
        rollback[kSecValueData as String] = previousData
        rollback[kSecAttrAccessible as String] = accessible
        _ = SecItemDelete(query as CFDictionary)
        _ = SecItemAdd(rollback as CFDictionary, nil)
        return false
    }

    private static func baseQuery(service: String, account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private static var isRunningUnderXCTest: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil ||
            NSClassFromString("XCTestCase") != nil
    }
}
