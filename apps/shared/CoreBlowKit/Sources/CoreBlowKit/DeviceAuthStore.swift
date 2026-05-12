// CoreBlowKit/Identity/DeviceAuthStore.swift
// Persists device auth tokens (role-scoped) to disk.
//
// Improvement: file permissions enforced at 0o600.

import Foundation

// MARK: - Auth Token Entry

/// A stored auth token for a specific role.
public struct DeviceAuthEntry: Codable, Sendable {
    public let token: String
    public let role: String
    public let scopes: [String]
    public let updatedAtMs: Int

    public init(token: String, role: String, scopes: [String], updatedAtMs: Int) {
        self.token = token
        self.role = role
        self.scopes = scopes
        self.updatedAtMs = updatedAtMs
    }
}

// MARK: - Store File Format

private struct AuthStoreFile: Codable {
    var version: Int
    var deviceId: String
    var tokens: [String: DeviceAuthEntry]
}

// MARK: - Device Auth Store

/// Manages device-scoped auth token persistence.
///
/// Tokens are stored per-device and per-role in a JSON file
/// with restricted permissions (0o600).
public enum DeviceAuthStore {
    private static let fileName = "device-auth.json"

    /// Load a stored token for the given device and role.
    public static func loadToken(deviceId: String, role: String) -> DeviceAuthEntry? {
        guard let store = readStore(), store.deviceId == deviceId else { return nil }
        return store.tokens[normalizeRole(role)]
    }

    /// Store a new device token for the given role.
    @discardableResult
    public static func storeToken(
        deviceId: String,
        role: String,
        token: String,
        scopes: [String] = []
    ) -> DeviceAuthEntry {
        let normalizedRole = normalizeRole(role)
        var store = readStore() ?? AuthStoreFile(version: 1, deviceId: deviceId, tokens: [:])

        // Reset store if device changed
        if store.deviceId != deviceId {
            store = AuthStoreFile(version: 1, deviceId: deviceId, tokens: [:])
        }

        let entry = DeviceAuthEntry(
            token: token,
            role: normalizedRole,
            scopes: normalizeScopes(scopes),
            updatedAtMs: Int(Date().timeIntervalSince1970 * 1000)
        )
        store.tokens[normalizedRole] = entry
        writeStore(store)
        return entry
    }

    /// Clear a stored token for the given device and role.
    public static func clearToken(deviceId: String, role: String) {
        guard var store = readStore(), store.deviceId == deviceId else { return }
        let key = normalizeRole(role)
        guard store.tokens[key] != nil else { return }
        store.tokens.removeValue(forKey: key)
        writeStore(store)
    }

    /// Clear all tokens for the given device.
    public static func clearAll(deviceId: String) {
        guard var store = readStore(), store.deviceId == deviceId else { return }
        store.tokens.removeAll()
        writeStore(store)
    }

    // MARK: - Private

    private static func normalizeRole(_ role: String) -> String {
        role.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizeScopes(_ scopes: [String]) -> [String] {
        Array(Set(
            scopes
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        )).sorted()
    }

    private static func fileURL() -> URL {
        CoreBlowPaths.identityDirectory()
            .appendingPathComponent(fileName, isDirectory: false)
    }

    private static func readStore() -> AuthStoreFile? {
        let url = fileURL()
        guard let data = try? Data(contentsOf: url),
              let store = try? JSONDecoder().decode(AuthStoreFile.self, from: data),
              store.version == 1
        else { return nil }
        return store
    }

    private static func writeStore(_ store: AuthStoreFile) {
        let url = fileURL()
        do {
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(),
                withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(store)
            try data.write(to: url, options: [.atomic])
            try? FileManager.default.setAttributes(
                [.posixPermissions: 0o600],
                ofItemAtPath: url.path)
        } catch {
            // Best-effort
        }
    }
}
