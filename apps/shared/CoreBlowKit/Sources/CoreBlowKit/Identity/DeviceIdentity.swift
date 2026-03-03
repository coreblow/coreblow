// CoreBlowKit/Identity/DeviceIdentity.swift
// Ed25519 device identity with CryptoKit.
//
// Key format: PEM (SPKI/PKCS8) — industry standard, matching CoreBlow.
// Internal CryptoKit operations use raw bytes, serialized as PEM for storage/wire.

import CryptoKit
import Foundation
import CoreBlowProtocol

// MARK: - Device Identity Model

/// Represents a device's cryptographic identity (Ed25519 key pair).
///
/// Keys are stored in PEM format for industry-standard interoperability:
/// - `publicKeyPem`: SPKI PEM (`-----BEGIN PUBLIC KEY-----`)
/// - `privateKeyPem`: PKCS8 PEM (`-----BEGIN PRIVATE KEY-----`)
///
/// This matches the CoreBlow device identity format exactly.
public struct DeviceIdentity: Codable, Sendable {
    /// Schema version for forward compatibility.
    public let version: Int
    public let deviceId: String
    public let publicKeyPem: String    // SPKI PEM format
    public let privateKeyPem: String   // PKCS8 PEM format
    public let createdAtMs: Int

    public init(version: Int = 1, deviceId: String, publicKeyPem: String, privateKeyPem: String, createdAtMs: Int) {
        self.version = version
        self.deviceId = deviceId
        self.publicKeyPem = publicKeyPem
        self.privateKeyPem = privateKeyPem
        self.createdAtMs = createdAtMs
    }

    // Legacy compat: map old "publicKey"/"privateKey" fields
    enum CodingKeys: String, CodingKey {
        case version
        case deviceId
        case publicKeyPem
        case privateKeyPem
        case createdAtMs
        // Legacy fields for reading old device.json
        case publicKey
        case privateKey
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.version = (try? container.decode(Int.self, forKey: .version)) ?? 1
        self.deviceId = try container.decode(String.self, forKey: .deviceId)
        self.createdAtMs = try container.decode(Int.self, forKey: .createdAtMs)

        // Try PEM fields first, fall back to legacy raw base64
        if let pem = try? container.decode(String.self, forKey: .publicKeyPem), pem.contains("BEGIN") {
            self.publicKeyPem = pem
        } else if let raw = try? container.decode(String.self, forKey: .publicKey) {
            // Legacy: raw base64 → convert to PEM
            self.publicKeyPem = DeviceIdentityStore.rawPublicKeyToPem(raw) ?? raw
        } else {
            self.publicKeyPem = try container.decode(String.self, forKey: .publicKeyPem)
        }

        if let pem = try? container.decode(String.self, forKey: .privateKeyPem), pem.contains("BEGIN") {
            self.privateKeyPem = pem
        } else if let raw = try? container.decode(String.self, forKey: .privateKey) {
            // Legacy: raw base64 → convert to PEM
            self.privateKeyPem = DeviceIdentityStore.rawPrivateKeyToPem(raw) ?? raw
        } else {
            self.privateKeyPem = try container.decode(String.self, forKey: .privateKeyPem)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(version, forKey: .version)
        try container.encode(deviceId, forKey: .deviceId)
        try container.encode(publicKeyPem, forKey: .publicKeyPem)
        try container.encode(privateKeyPem, forKey: .privateKeyPem)
        try container.encode(createdAtMs, forKey: .createdAtMs)
    }

    // MARK: - Convenience Accessors

    /// Raw 32-byte public key extracted from PEM.
    public var publicKeyRaw: Data? {
        DeviceIdentityStore.extractRawPublicKey(from: publicKeyPem)
    }

    /// Raw 32-byte private key extracted from PEM.
    public var privateKeyRaw: Data? {
        DeviceIdentityStore.extractRawPrivateKey(from: privateKeyPem)
    }
}

// MARK: - Storage Paths

/// Resolves filesystem paths for CoreBlow state storage.
public enum CoreBlowPaths {
    private static let envKeys = ["COREBLOW_STATE_DIR"]

    /// Root directory for CoreBlow persistent state.
    public static func stateDirectory() -> URL {
        for key in envKeys {
            if let raw = getenv(key) {
                let path = String(cString: raw).trimmingCharacters(in: .whitespacesAndNewlines)
                if !path.isEmpty {
                    return URL(fileURLWithPath: path, isDirectory: true)
                }
            }
        }

        if let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first {
            return appSupport.appendingPathComponent("CoreBlow", isDirectory: true)
        }

        return FileManager.default.temporaryDirectory
            .appendingPathComponent("coreblow", isDirectory: true)
    }

    /// Directory for identity-related files.
    public static func identityDirectory() -> URL {
        stateDirectory().appendingPathComponent("identity", isDirectory: true)
    }
}

// MARK: - DER Constants

private let ED25519_SPKI_HEADER: [UInt8] = [
    0x30, 0x2A, // SEQUENCE (42 bytes)
    0x30, 0x05, // SEQUENCE (5 bytes)
    0x06, 0x03, 0x2B, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
    0x03, 0x21, 0x00, // BIT STRING (33 bytes, 0 unused bits)
]

private let ED25519_PKCS8_HEADER: [UInt8] = [
    0x30, 0x2E, // SEQUENCE (46 bytes)
    0x02, 0x01, 0x00, // INTEGER (version 0)
    0x30, 0x05, // SEQUENCE (5 bytes)
    0x06, 0x03, 0x2B, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
    0x04, 0x22, // OCTET STRING (34 bytes)
    0x04, 0x20, // OCTET STRING (32 bytes) — the actual key
]

// MARK: - Device Identity Store

/// Manages device identity persistence and cryptographic operations.
///
/// Uses CryptoKit Curve25519 for Ed25519 key generation and signing.
/// Keys are stored in PEM format (SPKI/PKCS8) for industry-standard interoperability.
/// Files are written with 0o600 permissions for security.
public enum DeviceIdentityStore {
    private static let fileName = "device.json"

    /// Load existing identity or generate a new one.
    ///
    /// Handles migration from legacy raw base64 format to PEM.
    public static func loadOrCreate() -> DeviceIdentity {
        let url = fileURL()
        if let data = try? Data(contentsOf: url),
           let identity = try? JSONDecoder().decode(DeviceIdentity.self, from: data),
           !identity.deviceId.isEmpty,
           !identity.publicKeyPem.isEmpty,
           !identity.privateKeyPem.isEmpty
        {
            // Check if the raw file needs migration (contains "publicKey" but not "publicKeyPem")
            let fileText = String(data: data, encoding: .utf8) ?? ""
            let isLegacyFile = !fileText.contains("publicKeyPem") && fileText.contains("publicKey")
            if isLegacyFile {
                persist(identity) // Re-save with PEM fields
            }
            return identity
        }
        let identity = generate()
        persist(identity)
        return identity
    }

    /// Sign a payload string with the device's private key.
    ///
    /// Returns a base64url-encoded Ed25519 signature, or nil on failure.
    public static func sign(_ payload: String, with identity: DeviceIdentity) -> String? {
        guard let rawKey = extractRawPrivateKey(from: identity.privateKeyPem) else { return nil }
        do {
            let privateKey = try Curve25519.Signing.PrivateKey(rawRepresentation: rawKey)
            let signature = try privateKey.signature(for: Data(payload.utf8))
            return base64UrlEncode(signature)
        } catch {
            return nil
        }
    }

    /// Verify a signature against a payload using the device's public key.
    public static func verify(
        _ signature: String,
        for payload: String,
        with identity: DeviceIdentity
    ) -> Bool {
        guard let rawKey = extractRawPublicKey(from: identity.publicKeyPem),
              let sigData = base64UrlDecode(signature) else { return false }
        do {
            let publicKey = try Curve25519.Signing.PublicKey(rawRepresentation: rawKey)
            return publicKey.isValidSignature(sigData, for: Data(payload.utf8))
        } catch {
            return false
        }
    }

    /// Get the raw public key as a base64url string (for gateway connect frame).
    public static func publicKeyBase64Url(_ identity: DeviceIdentity) -> String? {
        guard let raw = extractRawPublicKey(from: identity.publicKeyPem) else { return nil }
        return base64UrlEncode(raw)
    }

    /// Get the public key in SPKI DER format (base64).
    public static func publicKeySPKIBase64(_ identity: DeviceIdentity) -> String? {
        guard let raw = extractRawPublicKey(from: identity.publicKeyPem), raw.count == 32 else { return nil }
        var spki = Data(ED25519_SPKI_HEADER)
        spki.append(raw)
        return spki.base64EncodedString()
    }

    /// Get the public key in SPKI DER format (base64url).
    public static func publicKeySPKIBase64Url(_ identity: DeviceIdentity) -> String? {
        guard let b64 = publicKeySPKIBase64(identity),
              let data = Data(base64Encoded: b64) else { return nil }
        return base64UrlEncode(data)
    }

    // MARK: - PEM Conversion (public for legacy migration in DeviceIdentity init)

    /// Convert raw base64 public key → SPKI PEM.
    public static func rawPublicKeyToPem(_ rawBase64: String) -> String? {
        guard let raw = Data(base64Encoded: rawBase64), raw.count == 32 else { return nil }
        var spki = Data(ED25519_SPKI_HEADER)
        spki.append(raw)
        return wrapPem(spki, label: "PUBLIC KEY")
    }

    /// Convert raw base64 private key → PKCS8 PEM.
    public static func rawPrivateKeyToPem(_ rawBase64: String) -> String? {
        guard let raw = Data(base64Encoded: rawBase64), raw.count == 32 else { return nil }
        var pkcs8 = Data(ED25519_PKCS8_HEADER)
        pkcs8.append(raw)
        return wrapPem(pkcs8, label: "PRIVATE KEY")
    }

    /// Extract raw 32-byte public key from SPKI PEM or raw base64.
    public static func extractRawPublicKey(from pem: String) -> Data? {
        if pem.contains("BEGIN") {
            guard let der = unwrapPem(pem) else { return nil }
            let header = Data(ED25519_SPKI_HEADER)
            if der.count == header.count + 32, der.prefix(header.count) == header {
                return der.suffix(32)
            }
            return nil
        }
        // Legacy: raw base64
        return Data(base64Encoded: pem)
    }

    /// Extract raw 32-byte private key from PKCS8 PEM or raw base64.
    public static func extractRawPrivateKey(from pem: String) -> Data? {
        if pem.contains("BEGIN") {
            guard let der = unwrapPem(pem) else { return nil }
            let header = Data(ED25519_PKCS8_HEADER)
            if der.count == header.count + 32, der.prefix(header.count) == header {
                return der.suffix(32)
            }
            return nil
        }
        // Legacy: raw base64
        return Data(base64Encoded: pem)
    }

    // MARK: - Private

    private static func generate() -> DeviceIdentity {
        let privateKey = Curve25519.Signing.PrivateKey()
        let publicKey = privateKey.publicKey
        let pubRaw = publicKey.rawRepresentation
        let privRaw = privateKey.rawRepresentation

        // Device ID = SHA-256 of raw public key bytes, lowercase hex
        let hash = SHA256.hash(data: pubRaw)
        let deviceId = hash.compactMap { String(format: "%02x", $0) }.joined()

        // Build SPKI PEM for public key
        var spki = Data(ED25519_SPKI_HEADER)
        spki.append(pubRaw)
        let publicKeyPem = wrapPem(spki, label: "PUBLIC KEY")!

        // Build PKCS8 PEM for private key
        var pkcs8 = Data(ED25519_PKCS8_HEADER)
        pkcs8.append(privRaw)
        let privateKeyPem = wrapPem(pkcs8, label: "PRIVATE KEY")!

        return DeviceIdentity(
            version: 1,
            deviceId: deviceId,
            publicKeyPem: publicKeyPem,
            privateKeyPem: privateKeyPem,
            createdAtMs: Int(Date().timeIntervalSince1970 * 1000)
        )
    }

    /// Migrate legacy identity (raw base64) to PEM format.
    private static func migrate(_ legacy: DeviceIdentity) -> DeviceIdentity {
        let pubPem = legacy.publicKeyPem.contains("BEGIN")
            ? legacy.publicKeyPem
            : (rawPublicKeyToPem(legacy.publicKeyPem) ?? legacy.publicKeyPem)
        let privPem = legacy.privateKeyPem.contains("BEGIN")
            ? legacy.privateKeyPem
            : (rawPrivateKeyToPem(legacy.privateKeyPem) ?? legacy.privateKeyPem)

        // Recompute deviceId from raw key to ensure consistency
        let rawPub = extractRawPublicKey(from: pubPem)
        let deviceId: String
        if let raw = rawPub {
            let hash = SHA256.hash(data: raw)
            deviceId = hash.compactMap { String(format: "%02x", $0) }.joined()
        } else {
            deviceId = legacy.deviceId
        }

        return DeviceIdentity(
            version: 1,
            deviceId: deviceId,
            publicKeyPem: pubPem,
            privateKeyPem: privPem,
            createdAtMs: legacy.createdAtMs
        )
    }

    private static func persist(_ identity: DeviceIdentity) {
        let url = fileURL()
        do {
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(),
                withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(identity)
            try data.write(to: url, options: [.atomic])
            try? FileManager.default.setAttributes(
                [.posixPermissions: 0o600],
                ofItemAtPath: url.path)
        } catch {
            // Best-effort persistence
        }
    }

    private static func fileURL() -> URL {
        CoreBlowPaths.identityDirectory()
            .appendingPathComponent(fileName, isDirectory: false)
    }

    // MARK: - PEM Helpers

    private static func wrapPem(_ der: Data, label: String) -> String? {
        let b64 = der.base64EncodedString(options: .lineLength64Characters)
        return "-----BEGIN \(label)-----\n\(b64)\n-----END \(label)-----\n"
    }

    private static func unwrapPem(_ pem: String) -> Data? {
        let lines = pem.components(separatedBy: .newlines)
            .filter { !$0.hasPrefix("-----") && !$0.isEmpty }
        let b64 = lines.joined()
        return Data(base64Encoded: b64)
    }

    // MARK: - Base64URL

    private static func base64UrlEncode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
    }

    private static func base64UrlDecode(_ str: String) -> Data? {
        var base64 = str
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 { base64 += String(repeating: "=", count: 4 - remainder) }
        return Data(base64Encoded: base64)
    }
}
