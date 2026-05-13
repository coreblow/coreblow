// CoreBlowKitTests/IdentityTests.swift
// Tests for Wave 2: Device Identity + Auth

import Testing
import Foundation
@testable import CoreBlowKit
@testable import CoreBlowProtocol

@Suite("DeviceIdentity")
struct DeviceIdentityTests {

    @Test("loadOrCreate generates valid identity")
    func loadOrCreate() {
        let identity = DeviceIdentityStore.loadOrCreate()
        #expect(!identity.deviceId.isEmpty)
        #expect(!identity.publicKeyPem.isEmpty)
        #expect(!identity.privateKeyPem.isEmpty)
        #expect(identity.publicKeyPem.contains("BEGIN PUBLIC KEY"))
        #expect(identity.privateKeyPem.contains("BEGIN PRIVATE KEY"))
        #expect(identity.version == 1)
        #expect(identity.createdAtMs > 0)
        // Device ID should be 64 hex chars (SHA-256)
        #expect(identity.deviceId.count == 64)
    }

    @Test("sign and verify round-trip")
    func signVerify() {
        let identity = DeviceIdentityStore.loadOrCreate()
        let payload = "test-payload-\(UUID().uuidString)"

        let signature = DeviceIdentityStore.sign(payload, with: identity)
        #expect(signature != nil)

        let valid = DeviceIdentityStore.verify(signature!, for: payload, with: identity)
        #expect(valid == true)

        // Tampered payload should fail
        let invalid = DeviceIdentityStore.verify(signature!, for: "tampered", with: identity)
        #expect(invalid == false)
    }

    @Test("publicKeyBase64Url format")
    func publicKeyFormat() {
        let identity = DeviceIdentityStore.loadOrCreate()
        let b64url = DeviceIdentityStore.publicKeyBase64Url(identity)
        #expect(b64url != nil)
        // base64url should not contain +, /, or =
        #expect(!b64url!.contains("+"))
        #expect(!b64url!.contains("/"))
        #expect(!b64url!.contains("="))
    }

    @Test("identity is deterministic on reload")
    func deterministic() {
        let a = DeviceIdentityStore.loadOrCreate()
        let b = DeviceIdentityStore.loadOrCreate()
        #expect(a.deviceId == b.deviceId)
        #expect(a.publicKeyPem == b.publicKeyPem)
    }
}

@Suite("DeviceAuthPayload")
struct DeviceAuthPayloadTests {

    @Test("buildV3 format")
    func v3Format() {
        let payload = DeviceAuthPayload.buildV3(
            deviceId: "abc123",
            clientId: "coreblow-ios",
            clientMode: "ui",
            role: "operator",
            scopes: ["admin", "read"],
            signedAtMs: 1700000000000,
            token: "tok_xyz",
            nonce: "nonce123",
            platform: "macOS",
            deviceFamily: "Mac"
        )
        let parts = payload.split(separator: "|", omittingEmptySubsequences: false)
        #expect(parts.count == 11)
        #expect(parts[0] == "v3")
        #expect(parts[1] == "abc123")
        #expect(parts[2] == "coreblow-ios")
        #expect(parts[3] == "ui")
        #expect(parts[4] == "operator")
        #expect(parts[5] == "admin,read")
        #expect(parts[7] == "tok_xyz")
        #expect(parts[8] == "nonce123")
        #expect(parts[9] == "macos")  // lowercased
        #expect(parts[10] == "mac")   // lowercased
    }

    @Test("normalizeMetadataField lowercases ASCII only")
    func normalize() {
        #expect(DeviceAuthPayload.normalizeMetadataField("MacOS") == "macos")
        #expect(DeviceAuthPayload.normalizeMetadataField("  iPad  ") == "ipad")
        #expect(DeviceAuthPayload.normalizeMetadataField(nil) == "")
        #expect(DeviceAuthPayload.normalizeMetadataField("") == "")
        // Non-ASCII should pass through
        #expect(DeviceAuthPayload.normalizeMetadataField("Ñ") == "Ñ")
    }

    @Test("signedDeviceDictionary returns valid FlexValue dict")
    func signedDict() {
        let identity = DeviceIdentityStore.loadOrCreate()
        let payload = DeviceAuthPayload.buildV3(
            deviceId: identity.deviceId, clientId: "test",
            clientMode: "ui", role: "operator", scopes: [],
            signedAtMs: 1000, token: nil, nonce: "n",
            platform: nil, deviceFamily: nil
        )
        let dict = DeviceAuthPayload.signedDeviceDictionary(
            payload: payload, identity: identity,
            signedAtMs: 1000, nonce: "n"
        )
        #expect(dict != nil)
        #expect(dict?["id"]?.stringValue == identity.deviceId)
        #expect(dict?["publicKey"]?.stringValue != nil)
        #expect(dict?["signature"]?.stringValue != nil)
        #expect(dict?["signedAt"]?.intValue == 1000)
        #expect(dict?["nonce"]?.stringValue == "n")
    }
}

@Suite("DeviceAuthStore", .serialized)
struct DeviceAuthStoreTests {

    @Test("store and load token")
    func storeLoad() async throws {
        try await withTemporaryCoreBlowStateDirectory(prefix: "cb-auth-test") { _ in
            let identity = DeviceIdentityStore.loadOrCreate()
            let deviceId = identity.deviceId
            let role = "test-role-\(UUID().uuidString.prefix(8))"
            let entry = DeviceAuthStore.storeToken(
                deviceId: deviceId, role: role,
                token: "tok_abc", scopes: ["admin"]
            )
            #expect(entry.token == "tok_abc")
            #expect(entry.role == role)

            let loaded = DeviceAuthStore.loadToken(deviceId: deviceId, role: role)
            #expect(loaded?.token == "tok_abc")

            // Wrong device should return nil
            let wrong = DeviceAuthStore.loadToken(deviceId: "wrong", role: role)
            #expect(wrong == nil)

            // Cleanup
            DeviceAuthStore.clearToken(deviceId: deviceId, role: role)
        }
    }

    @Test("clear token")
    func clearToken() async throws {
        try await withTemporaryCoreBlowStateDirectory(prefix: "cb-auth-clear") { _ in
            let identity = DeviceIdentityStore.loadOrCreate()
            let deviceId = identity.deviceId
            let role = "test-clear-\(UUID().uuidString.prefix(8))"
            DeviceAuthStore.storeToken(deviceId: deviceId, role: role, token: "t1")
            DeviceAuthStore.clearToken(deviceId: deviceId, role: role)
            let loaded = DeviceAuthStore.loadToken(deviceId: deviceId, role: role)
            #expect(loaded == nil)
        }
    }
}

@Suite("CoreBlowPaths")
struct CoreBlowPathsTests {

    @Test("stateDirectory returns valid URL")
    func stateDir() {
        let url = CoreBlowPaths.stateDirectory()
        // When COREBLOW_STATE_DIR env is set (e.g., by other tests), path may not contain "CoreBlow"
        let hasEnvOverride = ProcessInfo.processInfo.environment["COREBLOW_STATE_DIR"] != nil
        #expect(hasEnvOverride || url.path.contains("CoreBlow") || url.path.contains("coreblow"))
    }

    @Test("identityDirectory is under stateDirectory")
    func identityDir() {
        let state = CoreBlowPaths.stateDirectory()
        let ident = CoreBlowPaths.identityDirectory()
        #expect(ident.path.hasPrefix(state.path))
        #expect(ident.path.hasSuffix("identity"))
    }
}

@Suite("InstanceIdentity")
struct InstanceIdentityTests {

    @Test("instanceId is non-empty and stable")
    func instanceId() {
        let id = InstanceIdentity.instanceId
        #expect(!id.isEmpty)
        #expect(id == InstanceIdentity.instanceId) // stable
    }

    @Test("displayName is non-empty")
    func displayName() {
        #expect(!InstanceIdentity.displayName.isEmpty)
    }

    @Test("platformString contains macOS")
    func platform() {
        #expect(InstanceIdentity.platformString.contains("macOS"))
    }

    @Test("deviceFamily is Mac on macOS")
    func deviceFamily() {
        #expect(InstanceIdentity.deviceFamily == "Mac")
    }
}
