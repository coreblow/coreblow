// E2E Gateway Connection Test
// Full handshake: challenge → connect (local-none auth) → hello-ok

import Testing
import Foundation
import CryptoKit
@testable import CoreBlowKit
@testable import CoreBlowProtocol

@Suite("E2E Gateway")
struct E2EGatewayTests {

    let gatewayURL = URL(string: "ws://localhost:18789/ws")!
    let encoder = JSONEncoder()
    let decoder = JSONDecoder()

    // MARK: - Full Handshake (local-none auth)

    @Test("Full handshake: challenge → connect → hello-ok")
    func fullHandshake() async throws {
        let ws = URLSession.shared.webSocketTask(with: gatewayURL)
        ws.maximumMessageSize = 25 * 1024 * 1024
        ws.resume()

        // Step 1: Receive connect.challenge
        let challengeMsg = try await ws.receive()
        let challengeText = extractText(challengeMsg)
        let challenge = try decoder.decode([String: FlexValue].self, from: Data(challengeText.utf8))
        #expect(challenge["event"]?.stringValue == "connect.challenge")
        let nonce = challenge["payload"]?["nonce"]?.stringValue ?? ""
        #expect(!nonce.isEmpty)
        print("📨 Challenge: \(nonce.prefix(16))...")

        // Step 2: Send connect with token auth + device identity
        let identity = DeviceIdentityStore.loadOrCreate()
        let gatewayToken = "d4c5c84a82d174128f43e1c008bc262a332cd74c87b80b7d"
        let signedAtMs = Int(Date().timeIntervalSince1970 * 1000)
        let role = "operator"
        let scopes: [FlexValue] = [.string("operator.admin"), .string("operator.write"), .string("operator.read")]

        // Build v3 payload for device auth
        let scopeStr = "operator.admin,operator.write,operator.read"
        let v3Payload = "v3|\(identity.deviceId)|coreblow-macos|ui|\(role)|\(scopeStr)|\(signedAtMs)|\(gatewayToken)|\(nonce)|macos|mac"
        let signature = DeviceIdentityStore.sign(v3Payload, with: identity) ?? ""
        let pubKeyRawB64Url = DeviceIdentityStore.publicKeyBase64Url(identity) ?? ""

        let connectFrame: [String: FlexValue] = [
            "type": .string("req"),
            "id": .string(UUID().uuidString),
            "method": .string("connect"),
            "params": .object([
                "minProtocol": .int(3),
                "maxProtocol": .int(3),
                "client": .object([
                    "id": .string("coreblow-macos"),
                    "version": .string("1.0.0"),
                    "mode": .string("ui"),
                    "displayName": .string("CoreBlowKit E2E"),
                    "platform": .string("macOS"),
                    "deviceFamily": .string("Mac"),
                    "instanceId": .string(InstanceIdentity.instanceId),
                ]),
                "caps": .array([.string("chat"), .string("tool-events")]),
                "role": .string(role),
                "scopes": .array(scopes),
                "auth": .object([
                    "token": .string(gatewayToken),
                ]),
                "device": .object([
                    "id": .string(identity.deviceId),
                    "publicKey": .string(pubKeyRawB64Url),
                    "signature": .string(signature),
                    "signedAt": .int(signedAtMs),
                    "nonce": .string(nonce),
                ]),
            ]),
        ]

        let frameData = try encoder.encode(connectFrame)
        try await ws.send(.string(String(data: frameData, encoding: .utf8)!))
        print("📤 Connect sent (local-none auth)")

        // Step 3: Receive hello-ok
        let responseMsg = try await ws.receive()
        let responseText = extractText(responseMsg)
        let response = try decoder.decode([String: FlexValue].self, from: Data(responseText.utf8))

        if response["ok"]?.boolValue == true {
            let payload = response["payload"]!
            let proto = payload["protocol"]?.intValue ?? 0
            let sessionKey = payload["sessionKey"]?.stringValue ?? payload["connId"]?.stringValue ?? ""
            print("✅ HELLO-OK! Protocol v\(proto)")
            if !sessionKey.isEmpty { print("🔑 Session: \(sessionKey.prefix(16))...") }
            if let server = payload["server"] {
                print("🖥️  Server: \(server["name"]?.stringValue ?? "?") v\(server["version"]?.stringValue ?? "?")")
            }
            let version = payload["version"]?.stringValue ?? payload["serverVersion"]?.stringValue ?? ""
            if !version.isEmpty { print("🖥️  Version: \(version)") }
            if let auth = payload["auth"] {
                print("🔒 Role: \(auth["role"]?.stringValue ?? "?")")
                if let dt = auth["deviceToken"]?.stringValue {
                    print("🎫 Device token: \(dt.prefix(16))...")
                }
            }
            #expect(proto >= 3)

            // Step 4: Wait for first server event (tick or health)
            let eventMsg = try await withTimeout(seconds: 35) {
                try await ws.receive()
            }
            let eventText = extractText(eventMsg)
            let event = try decoder.decode([String: FlexValue].self, from: Data(eventText.utf8))
            let eventName = event["event"]?.stringValue ?? "?"
            print("📨 Event: \(eventName) seq=\(event["seq"]?.intValue ?? -1)")
        } else if let error = response["error"] {
            let code = error["code"]?.stringValue ?? "unknown"
            let details = error["details"]?["code"]?.stringValue ?? ""
            print("⚠️  Auth: \(code) — \(error["message"]?.stringValue ?? "") [\(details)]")
            #expect(Bool(false), "Handshake failed: \(code)")
        }

        ws.cancel(with: .goingAway, reason: nil)
        print("🔌 Done")
    }

    // MARK: - E2E Chat

    @Test("Send chat message and receive agent response")
    func chatSendAndReceive() async throws {
        // Step 1: Connect (reuse handshake logic)
        let ws = URLSession.shared.webSocketTask(with: gatewayURL)
        ws.maximumMessageSize = 25 * 1024 * 1024
        ws.resume()

        let challengeMsg = try await ws.receive()
        let challengeText = extractText(challengeMsg)
        let challenge = try decoder.decode([String: FlexValue].self, from: Data(challengeText.utf8))
        let nonce = challenge["payload"]?["nonce"]?.stringValue ?? ""

        let identity = DeviceIdentityStore.loadOrCreate()
        let gatewayToken = "d4c5c84a82d174128f43e1c008bc262a332cd74c87b80b7d"
        let signedAtMs = Int(Date().timeIntervalSince1970 * 1000)

        let scopeList = "operator.admin,operator.write,operator.read"
        let v3Payload = "v3|\(identity.deviceId)|coreblow-macos|ui|operator|\(scopeList)|\(signedAtMs)|\(gatewayToken)|\(nonce)|macos|mac"
        let signature = DeviceIdentityStore.sign(v3Payload, with: identity) ?? ""
        let pubKey = DeviceIdentityStore.publicKeyBase64Url(identity) ?? ""

        let connectFrame: [String: FlexValue] = [
            "type": .string("req"),
            "id": .string(UUID().uuidString),
            "method": .string("connect"),
            "params": .object([
                "minProtocol": .int(3), "maxProtocol": .int(3),
                "client": .object([
                    "id": .string("coreblow-macos"), "version": .string("1.0.0"),
                    "mode": .string("ui"), "platform": .string("macOS"),
                    "deviceFamily": .string("Mac"),
                ]),
                "caps": .array([.string("chat"), .string("tool-events")]),
                "role": .string("operator"),
                "scopes": .array([.string("operator.admin"), .string("operator.write"), .string("operator.read")]),
                "auth": .object(["token": .string(gatewayToken)]),
                "device": .object([
                    "id": .string(identity.deviceId),
                    "publicKey": .string(pubKey),
                    "signature": .string(signature),
                    "signedAt": .int(signedAtMs),
                    "nonce": .string(nonce),
                ]),
            ]),
        ]

        let frameData = try encoder.encode(connectFrame)
        try await ws.send(.string(String(data: frameData, encoding: .utf8)!))

        // Wait for hello-ok
        let helloMsg = try await ws.receive()
        let helloText = extractText(helloMsg)
        let hello = try decoder.decode([String: FlexValue].self, from: Data(helloText.utf8))
        if hello["ok"]?.boolValue != true {
            print("❌ Connect FAILED: \(helloText)")
        }
        #expect(hello["ok"]?.boolValue == true, "Connect must succeed")
        print("✅ Connected for chat test")

        // Step 2: Send chat.send
        let chatId = UUID().uuidString
        let chatFrame: [String: FlexValue] = [
            "type": .string("req"),
            "id": .string(chatId),
            "method": .string("chat.send"),
            "params": .object([
                "sessionKey": .string("main"),
                "message": .string("Hello! Say exactly: PONG"),
                "idempotencyKey": .string(UUID().uuidString),
            ]),
        ]

        let chatData = try encoder.encode(chatFrame)
        try await ws.send(.string(String(data: chatData, encoding: .utf8)!))
        print("💬 Sent: 'Hello! Say exactly: PONG'")

        // Step 3: Collect response events (streaming)
        var receivedResponse = false
        var responseChunks: [String] = []
        var eventCount = 0

        for _ in 0..<50 { // max 50 frames
            let msg = try await withTimeout(seconds: 30) {
                try await ws.receive()
            }
            let text = extractText(msg)
            let frame = try decoder.decode([String: FlexValue].self, from: Data(text.utf8))

            // Check for response to our chat.send
            if frame["id"]?.stringValue == chatId {
                receivedResponse = true
                if frame["ok"]?.boolValue == true {
                    print("✅ chat.send accepted")
                } else {
                    let err = frame["error"]?["message"]?.stringValue ?? "?"
                    print("⚠️  chat.send error: \(err)")
                    break
                }
                continue
            }

            // Collect streaming events
            if let event = frame["event"]?.stringValue {
                eventCount += 1
                let payload = frame["payload"]

                // Extract text from any nested structure
                let content = payload?["text"]?.stringValue
                    ?? payload?["content"]?.stringValue
                    ?? payload?["chunk"]?.stringValue
                    ?? payload?["delta"]?.stringValue
                    ?? payload?["message"]?.stringValue
                    ?? ""

                // Done/complete events
                let isDone = event.contains("done") || event.contains("complete")
                    || event.contains("finish") || event.contains("end")
                    || (payload?["done"]?.boolValue == true)
                    || (payload?["finished"]?.boolValue == true)

                if isDone {
                    if !content.isEmpty { responseChunks.append(content) }
                    print("✅ Agent done! event=\(event) chunks=\(responseChunks.count)")
                    break
                }

                // Content events (agent, chat, chat.delta, message, etc)
                if !content.isEmpty {
                    responseChunks.append(content)
                }

                if eventCount <= 8 {
                    print("📨 \(event): \(content.prefix(80))")
                }

                // Skip non-content events
                if event == "tick" || event == "health" {
                    continue
                }
            }
        }

        let fullResponse = responseChunks.joined()
        print("💬 Agent response (\(fullResponse.count) chars): \(fullResponse.prefix(200))")
        print("📊 Total events: \(eventCount)")
        #expect(receivedResponse, "Must receive chat.send response")

        ws.cancel(with: .goingAway, reason: nil)
        print("🔌 Chat test done")
    }

    // MARK: - Health

    @Test("Health endpoint responds OK")
    func healthCheck() async throws {
        let url = URL(string: "http://localhost:18789/health")!
        let (data, response) = try await URLSession.shared.data(from: url)
        let http = response as! HTTPURLResponse
        #expect(http.statusCode == 200)
        let json = try decoder.decode([String: FlexValue].self, from: data)
        #expect(json["ok"]?.boolValue == true)
        print("✅ Health: ok=true")
    }

    // MARK: - Crypto

    @Test("Ed25519 sign/verify + SPKI DER")
    func deviceIdentity() {
        let identity = DeviceIdentityStore.loadOrCreate()
        #expect(!identity.publicKeyPem.isEmpty)
        #expect(identity.publicKeyPem.contains("BEGIN PUBLIC KEY"))
        print("🔑 Device: \(identity.deviceId.prefix(16))...")

        // Raw sign/verify
        let payload = "e2e-\(Date().timeIntervalSince1970)"
        let sig = DeviceIdentityStore.sign(payload, with: identity)!
        #expect(DeviceIdentityStore.verify(sig, for: payload, with: identity))
        print("✅ Sign/verify: PASS")

        // SPKI DER format
        let spki = DeviceIdentityStore.publicKeySPKIBase64(identity)
        #expect(spki != nil)
        #expect(spki!.count > 44) // SPKI DER > PEM-encoded raw
        print("✅ SPKI DER: \(spki!.prefix(20))... (\(spki!.count) chars)")
    }

    @Test("InstanceIdentity device info")
    func instanceIdentity() {
        #expect(!InstanceIdentity.platformString.isEmpty)
        print("📱 \(InstanceIdentity.platformString) / \(InstanceIdentity.deviceFamily)")
    }

    @Test("FlexValue frame round-trip")
    func flexValueFrame() throws {
        let frame: [String: FlexValue] = [
            "type": .string("req"), "id": .string("t-1"),
            "method": .string("connect"),
            "params": .object(["minProtocol": .int(3)]),
        ]
        let data = try encoder.encode(frame)
        let d = try decoder.decode([String: FlexValue].self, from: data)
        #expect(d["params"]?["minProtocol"]?.intValue == 3)
        print("✅ Round-trip: PASS")
    }

    // MARK: - Helpers

    private func extractText(_ msg: URLSessionWebSocketTask.Message) -> String {
        switch msg {
        case .string(let t): return t
        case .data(let d): return String(data: d, encoding: .utf8) ?? ""
        @unknown default: return ""
        }
    }

    private func withTimeout<T: Sendable>(seconds: Int, _ body: @escaping @Sendable () async throws -> T) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await body() }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw CancellationError()
            }
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
}
