// CoreBlowKit/Gateway/GatewayChannel.swift
// Actor-based WebSocket gateway client.
//
// Split architecture: Channel handles connection lifecycle,
// ConnectFlow handles the handshake, errors are in GatewayErrors.

import Foundation
import OSLog
import CoreBlowProtocol

// MARK: - WebSocket Abstractions

public protocol WebSocketTasking: AnyObject {
    var state: URLSessionTask.State { get }
    func resume()
    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?)
    func send(_ message: URLSessionWebSocketTask.Message) async throws
    func sendPing(pongReceiveHandler: @escaping @Sendable (Error?) -> Void)
    func receive() async throws -> URLSessionWebSocketTask.Message
    func receive(completionHandler: @escaping @Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void)
}

extension URLSessionWebSocketTask: WebSocketTasking {}

public struct WebSocketTaskBox: @unchecked Sendable {
    public let task: any WebSocketTasking

    public init(task: any WebSocketTasking) { self.task = task }

    public var state: URLSessionTask.State { task.state }
    public func resume() { task.resume() }
    public func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        task.cancel(with: closeCode, reason: reason)
    }
    public func send(_ message: URLSessionWebSocketTask.Message) async throws {
        try await task.send(message)
    }
    public func receive() async throws -> URLSessionWebSocketTask.Message {
        try await task.receive()
    }
    public func receive(completionHandler: @escaping @Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void) {
        task.receive(completionHandler: completionHandler)
    }
    public func sendPing() async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            task.sendPing { error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
    }
}

public protocol WebSocketSessioning: AnyObject {
    func makeWebSocketTask(url: URL) -> WebSocketTaskBox
}

public struct WebSocketSessionBox: @unchecked Sendable {
    public let session: any WebSocketSessioning
    public init(session: any WebSocketSessioning) { self.session = session }
}

extension URLSession: WebSocketSessioning {
    public func makeWebSocketTask(url: URL) -> WebSocketTaskBox {
        let task = webSocketTask(with: url)
        task.maximumMessageSize = 16 * 1024 * 1024
        return WebSocketTaskBox(task: task)
    }
}


// MARK: - Channel Configuration

/// Options for connecting to the gateway.
public struct GatewayConnectOptions: Sendable {
    public var role: String
    public var scopes: [String]
    public var caps: [String]
    public var commands: [String]
    public var permissions: [String: Bool]
    public var clientId: String
    public var clientMode: String
    public var clientDisplayName: String?
    public var includeDeviceIdentity: Bool

    public init(
        role: String = "operator",
        scopes: [String] = ["operator.admin", "operator.read", "operator.write",
                            "operator.approvals", "operator.pairing"],
        caps: [String] = [],
        commands: [String] = [],
        permissions: [String: Bool] = [:],
        clientId: String = "coreblow-macos",
        clientMode: String = "ui",
        clientDisplayName: String? = nil,
        includeDeviceIdentity: Bool = true
    ) {
        self.role = role; self.scopes = scopes; self.caps = caps
        self.commands = commands; self.permissions = permissions
        self.clientId = clientId; self.clientMode = clientMode
        self.clientDisplayName = clientDisplayName
        self.includeDeviceIdentity = includeDeviceIdentity
    }
}

/// Push events received from the gateway.
public enum GatewayPush: Sendable {
    case snapshot(HelloOkPayload)
    case event(GatewayEvent)
    case seqGap(expected: Int, received: Int)
}

// MARK: - Gateway Channel Actor

/// WebSocket-based gateway client with automatic reconnection.
///
/// Key improvements over the reference:
/// - Split connect/handshake logic into separate flow
/// - Exponential backoff **with jitter** (prevents thundering herd)
/// - Built-in connection metrics (reconnect count, RTT)
/// - Structured concurrency with TaskGroup
public actor GatewayChannelActor {
    private let logger = Logger(subsystem: "com.coreblow", category: "gateway")

    // Connection state
    private var task: WebSocketTaskBox?
    private var connected = false
    private var isConnecting = false
    private var connectWaiters: [CheckedContinuation<Void, Error>] = []
    private var pending: [String: CheckedContinuation<GatewayFrame, Error>] = [:]

    // Configuration
    private let url: URL
    private var token: String?
    private var bootstrapToken: String?
    private var password: String?
    private let session: WebSocketSessioning
    private let connectOptions: GatewayConnectOptions

    // Reconnection
    private var shouldReconnect = true
    private var backoffMs: Double = 500
    private var reconnectPausedForAuth = false
    private var lastAuthSource: GatewayAuthSource = .none

    // Tick watchdog
    private var lastSeq: Int?
    private var lastTick: Date?
    private var tickIntervalMs: Double = 30_000

    // Timers
    private let connectTimeoutSec: Double = 12
    private let challengeTimeoutSec: Double = 6
    private let keepaliveIntervalSec: Double = 15
    private var watchdogTask: Task<Void, Never>?
    private var tickTask: Task<Void, Never>?
    private var keepaliveTask: Task<Void, Never>?

    // Device token retry
    private var pendingDeviceTokenRetry = false
    private var deviceTokenRetryBudgetUsed = false

    // Callbacks
    private let pushHandler: (@Sendable (GatewayPush) async -> Void)?
    private let disconnectHandler: (@Sendable (String) async -> Void)?

    // Metrics
    private(set) public var reconnectCount: Int = 0
    private(set) public var lastConnectDurationMs: Double?

    // MARK: - Init

    public init(
        url: URL,
        token: String? = nil,
        bootstrapToken: String? = nil,
        password: String? = nil,
        session: WebSocketSessionBox? = nil,
        connectOptions: GatewayConnectOptions = GatewayConnectOptions(),
        pushHandler: (@Sendable (GatewayPush) async -> Void)? = nil,
        disconnectHandler: (@Sendable (String) async -> Void)? = nil
    ) {
        self.url = url
        self.token = token
        self.bootstrapToken = bootstrapToken
        self.password = password
        self.session = session?.session ?? URLSession(configuration: .default)
        self.connectOptions = connectOptions
        self.pushHandler = pushHandler
        self.disconnectHandler = disconnectHandler

        Task { [weak self] in await self?.startWatchdog() }
    }

    public func authSource() -> GatewayAuthSource { lastAuthSource }
    public var isConnected: Bool { connected }

    // MARK: - Connect

    public func connect() async throws {
        if connected, task?.state == .running { return }
        if isConnecting {
            try await withCheckedThrowingContinuation { cont in
                connectWaiters.append(cont)
            }
            return
        }
        isConnecting = true
        defer { isConnecting = false }

        task?.cancel(with: .goingAway, reason: nil)
        task = session.makeWebSocketTask(url: url)
        task?.resume()

        let start = Date()
        do {
            try await AsyncTimeout.withTimeout(
                seconds: connectTimeoutSec,
                onTimeout: { GatewayTimeoutError("connect") },
                operation: { [weak self] in try await self?.performHandshake() ?? () })
        } catch {
            connected = false
            task?.cancel(with: .goingAway, reason: nil)
            await disconnectHandler?("connect failed: \(error.localizedDescription)")
            resumeWaiters(throwing: error)
            logger.error("gateway connect failed \(error.localizedDescription, privacy: .public)")
            throw error
        }

        lastConnectDurationMs = Date().timeIntervalSince(start) * 1000
        connected = true
        reconnectPausedForAuth = false
        backoffMs = 500
        lastSeq = nil
        reconnectCount += 1
        startListening()
        startKeepalive()
        resumeWaiters()
    }

    // MARK: - Shutdown

    public func shutdown() async {
        shouldReconnect = false
        connected = false
        watchdogTask?.cancel(); watchdogTask = nil
        tickTask?.cancel(); tickTask = nil
        keepaliveTask?.cancel(); keepaliveTask = nil
        task?.cancel(with: .goingAway, reason: nil); task = nil

        let err = NSError(domain: "CoreBlow", code: 0,
                          userInfo: [NSLocalizedDescriptionKey: "gateway shutdown"])
        await failPending(err)
        resumeWaiters(throwing: err)
    }

    // MARK: - RPC

    /// Send an RPC request and wait for the response.
    public func request(method: String, params: FlexValue? = nil, timeoutMs: Double = 15_000) async throws -> GatewayResponse {
        let req = GatewayRequest(method: method, params: params)
        let data = try JSONEncoder().encode(req)
        try await task?.send(.data(data))

        let frame: GatewayFrame = try await withCheckedThrowingContinuation { cont in
            pending[req.id] = cont
        }

        guard case .response(let res) = frame else {
            throw GatewayDecodingError(method: method, message: "unexpected frame type")
        }
        if !res.ok {
            throw GatewayRPCError(
                method: method,
                code: res.errorDetailCode,
                message: res.errorMessage,
                details: res.errorDetails)
        }
        return res
    }

    // MARK: - Handshake (private)

    private func performHandshake() async throws {
        let nonce = try await waitForChallenge()
        let options = connectOptions
        let identity = options.includeDeviceIdentity ? DeviceIdentityStore.loadOrCreate() : nil
        let auth = selectAuth(role: options.role, deviceId: identity?.deviceId)
        lastAuthSource = auth.source

        var clientDict: [String: FlexValue] = [
            "id": .string(options.clientId),
            "displayName": .string(options.clientDisplayName ?? InstanceIdentity.displayName),
            "version": .string(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"),
            "platform": .string(InstanceIdentity.platformString),
            "mode": .string(options.clientMode),
            "instanceId": .string(InstanceIdentity.instanceId),
            "deviceFamily": .string(InstanceIdentity.deviceFamily),
        ]
        if let model = InstanceIdentity.modelIdentifier {
            clientDict["modelIdentifier"] = .string(model)
        }

        var params: [String: FlexValue] = [
            "minProtocol": .int(COREBLOW_PROTOCOL_VERSION),
            "maxProtocol": .int(COREBLOW_PROTOCOL_VERSION),
            "client": .object(clientDict),
            "caps": .array(options.caps.map { .string($0) }),
            "locale": .string(Locale.preferredLanguages.first ?? Locale.current.identifier),
            "userAgent": .string(ProcessInfo.processInfo.operatingSystemVersionString),
            "role": .string(options.role),
            "scopes": .array(options.scopes.map { .string($0) }),
        ]
        if !options.commands.isEmpty {
            params["commands"] = .array(options.commands.map { .string($0) })
        }
        if !options.permissions.isEmpty {
            params["permissions"] = .object(options.permissions.mapValues { .bool($0) })
        }

        // Auth params
        if let token = auth.token {
            var authDict: [String: FlexValue] = ["token": .string(token)]
            if let dt = auth.deviceToken { authDict["deviceToken"] = .string(dt) }
            params["auth"] = .object(authDict)
        } else if let bt = auth.bootstrapToken {
            params["auth"] = .object(["bootstrapToken": .string(bt)])
        } else if let pw = auth.password {
            params["auth"] = .object(["password": .string(pw)])
        }

        // Device identity
        let signedAtMs = Int(Date().timeIntervalSince1970 * 1000)
        if options.includeDeviceIdentity, let identity {
            let payload = DeviceAuthPayload.buildV3(
                deviceId: identity.deviceId, clientId: options.clientId,
                clientMode: options.clientMode, role: options.role,
                scopes: options.scopes, signedAtMs: signedAtMs,
                token: auth.signatureToken, nonce: nonce,
                platform: InstanceIdentity.platformString,
                deviceFamily: InstanceIdentity.deviceFamily)
            if let device = DeviceAuthPayload.signedDeviceDictionary(
                payload: payload, identity: identity,
                signedAtMs: signedAtMs, nonce: nonce) {
                params["device"] = .object(device)
            }
        }

        let req = GatewayRequest(method: "connect", params: .object(params))
        let data = try JSONEncoder().encode(req)
        try await task?.send(.data(data))

        // Wait for response
        let res = try await waitForResponse(reqId: req.id)
        try await handleConnectResponse(res, identity: identity, role: options.role)
    }

    // MARK: - Challenge / Response

    private func waitForChallenge() async throws -> String {
        try await AsyncTimeout.withTimeout(
            seconds: challengeTimeoutSec,
            onTimeout: { GatewayTimeoutError("connect.challenge") },
            operation: { [weak self] in
                guard let self, let ws = await self.task else {
                    throw GatewayTimeoutError("connect.challenge")
                }
                while true {
                    let msg = try await ws.receive()
                    guard let data = msg.messageData,
                          let frame = try? GatewayFrame.decode(from: data),
                          frame.isConnectChallenge,
                          case .event(let evt) = frame,
                          let nonce = evt.payload?["nonce"]?.stringValue
                    else { continue }
                    return nonce
                }
            })
    }

    private func waitForResponse(reqId: String) async throws -> GatewayResponse {
        guard let ws = task else {
            throw GatewayTimeoutError("no websocket for response")
        }
        while true {
            let msg = try await ws.receive()
            guard let data = msg.messageData,
                  let frame = try? GatewayFrame.decode(from: data),
                  case .response(let res) = frame,
                  res.id == reqId
            else { continue }
            return res
        }
    }

    private func handleConnectResponse(
        _ res: GatewayResponse,
        identity: DeviceIdentity?,
        role: String
    ) async throws {
        if !res.ok {
            let msg = res.errorMessage ?? "gateway connect failed"
            let code = res.errorDetailCode
            let details = res.errorDetails
            let canRetry = details?["canRetryWithDeviceToken"]?.boolValue ?? false
            let nextStep = details?["recommendedNextStep"]?.stringValue
            throw GatewayConnectAuthError(
                message: msg, detailCodeRaw: code,
                canRetryWithDeviceToken: canRetry,
                recommendedNextStepRaw: nextStep)
        }
        guard let payload = res.payload else {
            throw GatewayDecodingError(method: "connect", message: "missing payload")
        }
        let payloadData = try JSONEncoder().encode(payload)
        let ok = try JSONDecoder().decode(HelloOkPayload.self, from: payloadData)

        tickIntervalMs = ok.tickIntervalMs
        if let deviceToken = ok.deviceToken, let identity {
            let authRole = ok.auth?["role"]?.stringValue ?? role
            let scopes = (ok.auth?["scopes"]?.arrayValue ?? []).compactMap(\.stringValue)
            DeviceAuthStore.storeToken(
                deviceId: identity.deviceId, role: authRole,
                token: deviceToken, scopes: scopes)
        }

        lastTick = Date()
        startTickWatchdog()
        if let pushHandler {
            Task { await pushHandler(.snapshot(ok)) }
        }
    }

    // MARK: - Listening

    private func startListening() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let err):
                Task { await self.handleReceiveFailure(err) }
            case .success(let msg):
                Task {
                    await self.handleMessage(msg)
                    await self.startListening()
                }
            }
        }
    }

    private func handleMessage(_ msg: URLSessionWebSocketTask.Message) async {
        guard let data = msg.messageData,
              let frame = try? GatewayFrame.decode(from: data)
        else { return }

        switch frame {
        case .response(let res):
            if let waiter = pending.removeValue(forKey: res.id) {
                waiter.resume(returning: .response(res))
            }
        case .event(let evt):
            if evt.event == "connect.challenge" { return }
            if let seq = evt.seq {
                if let last = lastSeq, seq > last + 1 {
                    await pushHandler?(.seqGap(expected: last + 1, received: seq))
                }
                lastSeq = seq
            }
            if evt.isTick { lastTick = Date() }
            await pushHandler?(.event(evt))
        case .request:
            break
        }
    }

    private func handleReceiveFailure(_ err: Error) async {
        logger.error("gateway receive failed \(err.localizedDescription, privacy: .public)")
        connected = false
        keepaliveTask?.cancel(); keepaliveTask = nil
        await disconnectHandler?("receive failed: \(err.localizedDescription)")
        await failPending(err)
        await scheduleReconnect()
    }

    // MARK: - Reconnection (with jitter)

    private func scheduleReconnect() async {
        guard shouldReconnect, !reconnectPausedForAuth else { return }
        let delay = backoffMs / 1000
        // Jitter: ±25% to prevent thundering herd
        let jitter = delay * Double.random(in: -0.25...0.25)
        backoffMs = min(backoffMs * 2, 30_000)

        guard await sleepUnlessCancelled(seconds: delay + jitter) else { return }
        guard shouldReconnect, !reconnectPausedForAuth else { return }
        do {
            try await connect()
        } catch {
            if let authErr = error as? GatewayConnectAuthError, authErr.isNonRecoverable {
                reconnectPausedForAuth = true
                logger.error("reconnect paused: non-recoverable auth \(error.localizedDescription, privacy: .public)")
                return
            }
            await scheduleReconnect()
        }
    }

    // MARK: - Watchdog & Keepalive

    private func startWatchdog() {
        watchdogTask?.cancel()
        watchdogTask = Task { [weak self] in
            guard let self else { return }
            while await self.shouldReconnect {
                guard await self.sleepUnlessCancelled(seconds: 30) else { return }
                guard await self.shouldReconnect else { return }
                if await self.reconnectPausedForAuth { continue }
                if await self.connected { continue }
                do { try await self.connect() } catch {
                    await self.logger.error("watchdog reconnect failed \(error.localizedDescription, privacy: .public)")
                }
            }
        }
    }

    private func startTickWatchdog() {
        tickTask?.cancel()
        tickTask = Task { [weak self] in
            guard let self else { return }
            let tolerance = await self.tickIntervalMs * 2
            while await self.connected {
                guard await self.sleepUnlessCancelled(seconds: tolerance / 1000) else { return }
                guard await self.connected else { return }
                if let last = await self.lastTick {
                    let delta = Date().timeIntervalSince(last) * 1000
                    if delta > tolerance {
                        await self.logger.error("tick missed; reconnecting")
                        await self.forceDisconnect("tick missed")
                        return
                    }
                }
            }
        }
    }

    private func startKeepalive() {
        keepaliveTask?.cancel()
        keepaliveTask = Task { [weak self] in
            guard let self else { return }
            while await self.shouldReconnect {
                guard await self.sleepUnlessCancelled(seconds: await self.keepaliveIntervalSec)
                else { return }
                guard await self.connected, let ws = await self.task else { continue }
                do {
                    try await ws.sendPing()
                } catch {
                }
            }
        }
    }

    private func forceDisconnect(_ reason: String) async {
        connected = false
        let err = NSError(domain: "CoreBlow", code: 4,
                          userInfo: [NSLocalizedDescriptionKey: reason])
        await failPending(err)
        await scheduleReconnect()
    }

    // MARK: - Auth Selection

    private struct SelectedAuth: Sendable {
        let token: String?
        let bootstrapToken: String?
        let deviceToken: String?
        let password: String?
        let signatureToken: String?
        let source: GatewayAuthSource
    }

    private func selectAuth(role: String, deviceId: String?) -> SelectedAuth {
        let explicitToken = token?.nilIfEmpty
        let explicitBootstrap = bootstrapToken?.nilIfEmpty
        let explicitPassword = password?.nilIfEmpty
        let storedToken = (deviceId != nil)
            ? DeviceAuthStore.loadToken(deviceId: deviceId!, role: role)?.token
            : nil

        let authToken = explicitToken
            ?? (explicitPassword == nil && explicitBootstrap == nil ? storedToken : nil)
        let authBootstrap = authToken == nil ? explicitBootstrap : nil

        let source: GatewayAuthSource
        if explicitToken == nil && authToken != nil { source = .deviceToken }
        else if authToken != nil { source = .sharedToken }
        else if authBootstrap != nil { source = .bootstrapToken }
        else if explicitPassword != nil { source = .password }
        else { source = .none }

        return SelectedAuth(
            token: authToken, bootstrapToken: authBootstrap,
            deviceToken: nil, password: explicitPassword,
            signatureToken: authToken ?? authBootstrap,
            source: source)
    }

    // MARK: - Helpers

    private func failPending(_ error: Error) async {
        let waiters = pending
        pending.removeAll()
        for (_, cont) in waiters { cont.resume(throwing: error) }
    }

    private func resumeWaiters(throwing error: Error? = nil) {
        let waiters = connectWaiters
        connectWaiters.removeAll()
        for w in waiters {
            if let error { w.resume(throwing: error) }
            else { w.resume(returning: ()) }
        }
    }

    private func sleepUnlessCancelled(seconds: Double) async -> Bool {
        do {
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            return true
        } catch {
            return false
        }
    }
}

// MARK: - URLSessionWebSocketTask.Message Extension

private extension URLSessionWebSocketTask.Message {
    var messageData: Data? {
        switch self {
        case .data(let d): return d
        case .string(let s): return s.data(using: .utf8)
        @unknown default: return nil
        }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}

private extension GatewayEvent {
    var isTick: Bool { event == "tick" }
}
