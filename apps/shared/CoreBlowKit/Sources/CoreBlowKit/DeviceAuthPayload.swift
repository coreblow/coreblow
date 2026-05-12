// CoreBlowKit/Identity/DeviceAuthPayload.swift
// Builds signed auth payloads for the gateway connect handshake.

import Foundation
import CoreBlowProtocol

/// Builds cryptographically signed device auth payloads.
public enum DeviceAuthPayload {
    /// Build a v3 payload string for signing.
    ///
    /// Format: `v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily`
    public static func buildV3(
        deviceId: String,
        clientId: String,
        clientMode: String,
        role: String,
        scopes: [String],
        signedAtMs: Int,
        token: String?,
        nonce: String,
        platform: String?,
        deviceFamily: String?
    ) -> String {
        [
            "v3",
            deviceId,
            clientId,
            clientMode,
            role,
            scopes.joined(separator: ","),
            String(signedAtMs),
            token ?? "",
            nonce,
            normalizeMetadataField(platform),
            normalizeMetadataField(deviceFamily),
        ].joined(separator: "|")
    }

    /// Build the signed device dictionary for the connect request.
    public static func signedDeviceDictionary(
        payload: String,
        identity: DeviceIdentity,
        signedAtMs: Int,
        nonce: String
    ) -> [String: FlexValue]? {
        guard let signature = DeviceIdentityStore.sign(payload, with: identity),
              let publicKey = DeviceIdentityStore.publicKeyBase64Url(identity)
        else { return nil }

        return [
            "id": .string(identity.deviceId),
            "publicKey": .string(publicKey),
            "signature": .string(signature),
            "signedAt": .int(signedAtMs),
            "nonce": .string(nonce),
        ]
    }

    /// Normalize metadata fields for deterministic cross-platform signing.
    ///
    /// Lowercases ASCII A-Z only (same logic as gateway TypeScript).
    static func normalizeMetadataField(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "" }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        var output = ""
        output.reserveCapacity(trimmed.count)
        for scalar in trimmed.unicodeScalars {
            let cp = scalar.value
            if cp >= 65, cp <= 90, let lowered = UnicodeScalar(cp + 32) {
                output.unicodeScalars.append(lowered)
            } else {
                output.unicodeScalars.append(scalar)
            }
        }
        return output
    }
}
