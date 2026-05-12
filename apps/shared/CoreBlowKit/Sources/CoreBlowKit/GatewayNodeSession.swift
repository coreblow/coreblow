// CoreBlowKit/Gateway/GatewayNodeSession.swift
// Actor that manages a gateway node session — incoming invoke routing,
// server event subscriptions, canvas host URL management.

import Foundation
import OSLog
import CoreBlowProtocol

// MARK: - Invoke Request (internal wire format)

private struct NodeInvokeRequestPayload: Codable, Sendable {
    var id: String
    var nodeId: String
    var command: String
    var paramsJSON: String?
    var timeoutMs: Int?
    var idempotencyKey: String?
}

// MARK: - Canvas URL Helpers

/// Replace the capability segment within a scoped canvas host URL.
func replaceCanvasCapability(in scopedUrl: String, with capability: String) -> String? {
    let marker = "/__coreblow__/cap/"
    guard let range = scopedUrl.range(of: marker) else { return nil }
    let start = range.upperBound
    let rest = scopedUrl[start...]
    let end = [rest.firstIndex(of: "/"), rest.firstIndex(of: "?"),
               rest.firstIndex(of: "#")].compactMap { $0 }.min() ?? scopedUrl.endIndex
    guard start < end else { return nil }
    return String(scopedUrl[..<start]) + capability + String(scopedUrl[end...])
}

/// Canonicalize a canvas host URL relative to the active WebSocket URL.
func canonicalizeCanvasHostUrl(raw: String?, activeURL: URL?) -> String? {
    let trimmed = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    guard var components = URLComponents(string: trimmed) else { return trimmed }

    let host = (components.host ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let isLoopback = !host.isEmpty && LoopbackHost.isLoopback(host)

    if !host.isEmpty, !isLoopback {
        guard let activeURL else { return trimmed }
        let isTLS = activeURL.scheme?.lowercased() == "wss"
        guard isTLS else { return trimmed }
        components.scheme = "https"
        if components.port == nil {
            let port = activeURL.port ?? 443
            components.port = (port == 443) ? nil : port
        }
        return components.string ?? trimmed
    }

    guard let activeURL, let fallbackHost = activeURL.host,
          !LoopbackHost.isLoopback(fallbackHost)
    else { return trimmed }

    let isTLS = activeURL.scheme?.lowercased() == "wss"
    components.scheme = isTLS ? "https" : "http"
    components.host = fallbackHost
    let port = activeURL.port ?? (isTLS ? 443 : 80)
    components.port = ((isTLS && port == 443) || (!isTLS && port == 80)) ? nil : port
    return components.string ?? trimmed
}

// MARK: - Gateway Node Session Actor

/// Manages the lifecycle of a node's connection to the gateway.
///
/// Handles:
/// - Incoming command invocations from the gateway with timeout
/// - Server event broadcasting via AsyncStream
/// - Canvas host URL management and capability refresh
/// - Snapshot waiting with timeout
public actor GatewayNodeSession {
    private let logger = Logger(subsystem: "com.coreblow", category: "node.gateway")
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private static let defaultInvokeTimeoutMs = 30_000

    private var channel: GatewayChannelActor?
    private var activeURL: URL?
    private var activeToken: String?
    private var activeBootstrapToken: String?
    private var activePassword: String?
    private var activeOptionsKey: String?
    private var connectOptions: GatewayConnectOptions?

    // Callbacks
    private var onConnected: (@Sendable () async -> Void)?
    private var onDisconnected: (@Sendable (String) async -> Void)?
    private var onInvoke: (@Sendable (BridgeInvokeRequest) async -> BridgeInvokeResponse)?

    // State
    private var hasEverConnected = false
    private var hasNotifiedConnected = false
    private var snapshotReceived = false
    private var snapshotWaiters: [CheckedContinuation<Bool, Never>] = []
    private var serverEventSubscribers: [UUID: AsyncStream<GatewayEvent>.Continuation] = [:]
    private var canvasHostUrl: String?

    public init() {}

    // MARK: - Connect

    /// Connect to the gateway with the given parameters.
    public func connect(
        url: URL,
        token: String?,
        bootstrapToken: String?,
        password: String?,
        connectOptions: GatewayConnectOptions,
        onConnected: @escaping @Sendable () async -> Void,
        onDisconnected: @escaping @Sendable (String) async -> Void,
        onInvoke: @escaping @Sendable (BridgeInvokeRequest) async -> BridgeInvokeResponse
    ) async throws {
        let nextKey = optionsKey(connectOptions)
        let shouldReconnect = activeURL != url || activeToken != token
            || activeBootstrapToken != bootstrapToken || activePassword != password
            || activeOptionsKey != nextKey || channel == nil

        self.connectOptions = connectOptions
        self.onConnected = onConnected
        self.onDisconnected = onDisconnected
        self.onInvoke = onInvoke

        if shouldReconnect {
            resetConnectionState()
            if let existing = channel { await existing.shutdown() }

            let ch = GatewayChannelActor(
                url: url, token: token, bootstrapToken: bootstrapToken,
                password: password, connectOptions: connectOptions,
                pushHandler: { [weak self] push in await self?.handlePush(push) },
                disconnectHandler: { [weak self] reason in
                    await self?.handleDisconnected(reason)
                })
            channel = ch
            activeURL = url; activeToken = token
            activeBootstrapToken = bootstrapToken; activePassword = password
            activeOptionsKey = nextKey
        }

        guard let ch = channel else {
            throw GatewayTimeoutError("channel unavailable")
        }
        try await ch.connect()
        _ = await waitForSnapshot(timeoutMs: 500)
        await notifyConnectedIfNeeded()
    }

    /// Disconnect from the gateway.
    public func disconnect() async {
        await channel?.shutdown()
        channel = nil; activeURL = nil; activeToken = nil
        activeBootstrapToken = nil; activePassword = nil
        activeOptionsKey = nil; hasEverConnected = false
        resetConnectionState()
    }

    // MARK: - Canvas

    /// Get the current canvas host URL.
    public func currentCanvasHostUrl() -> String? { canvasHostUrl }

    /// Refresh the canvas capability token.
    public func refreshCanvasCapability(timeoutMs: Int = 8_000) async -> Bool {
        guard let ch = channel else { return false }
        do {
            let res = try await ch.request(
                method: "node.canvas.capability.refresh",
                timeoutMs: Double(max(timeoutMs, 1)))
            guard let capability = res.payload?["canvasCapability"]?.stringValue,
                  !capability.isEmpty,
                  let scopedUrl = canvasHostUrl, !scopedUrl.isEmpty,
                  let refreshed = replaceCanvasCapability(in: scopedUrl, with: capability)
            else { return false }
            canvasHostUrl = refreshed
            return true
        } catch {
            logger.warning("canvas capability refresh failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    // MARK: - Remote Address

    /// Get the remote address of the active connection.
    public func currentRemoteAddress() -> String? {
        guard let url = activeURL, let host = url.host else { return activeURL?.absoluteString }
        let port = url.port ?? (url.scheme == "wss" ? 443 : 80)
        return host.contains(":") ? "[\(host)]:\(port)" : "\(host):\(port)"
    }

    // MARK: - Events

    /// Send a node event to the gateway.
    public func sendEvent(event: String, payloadJSON: String?) async {
        guard let ch = channel else { return }
        let params: FlexValue = .object([
            "event": .string(event),
            "payloadJSON": payloadJSON.map { .string($0) } ?? .null,
        ])
        _ = try? await ch.request(method: "node.event", params: params)
    }

    /// Subscribe to server events via AsyncStream.
    public func subscribeServerEvents(bufferSize: Int = 200) -> AsyncStream<GatewayEvent> {
        let id = UUID()
        return AsyncStream(bufferingPolicy: .bufferingNewest(bufferSize)) { continuation in
            serverEventSubscribers[id] = continuation
            continuation.onTermination = { @Sendable [weak self] _ in
                Task { await self?.removeSubscriber(id) }
            }
        }
    }

    // MARK: - Invoke with Timeout

    /// Execute a node invoke with a timeout guard.
    static func invokeWithTimeout(
        request: BridgeInvokeRequest,
        timeoutMs: Int?,
        onInvoke: @escaping @Sendable (BridgeInvokeRequest) async -> BridgeInvokeResponse
    ) async -> BridgeInvokeResponse {
        let timeout = max(0, timeoutMs ?? defaultInvokeTimeoutMs)
        guard timeout > 0 else { return await onInvoke(request) }

        do {
            return try await AsyncTimeout.withTimeoutMs(
                ms: timeout,
                onTimeout: { GatewayTimeoutError("node invoke \(request.command)") },
                operation: { await onInvoke(request) })
        } catch {
            return BridgeInvokeResponse(
                id: request.id, ok: false,
                error: NodeError(code: "UNAVAILABLE", message: "node invoke timed out"))
        }
    }

    // MARK: - Private: Push Handling

    private func handlePush(_ push: GatewayPush) async {
        switch push {
        case .snapshot(let ok):
            let raw = ok.canvasHostUrl
            canvasHostUrl = canonicalizeCanvasHostUrl(raw: raw, activeURL: activeURL)
            if hasEverConnected {
                broadcastEvent(GatewayEvent(event: "seqGap", payload: nil, seq: nil))
            }
            hasEverConnected = true
            markSnapshotReceived()
            await notifyConnectedIfNeeded()
        case .event(let evt):
            await handleEvent(evt)
        case .seqGap:
            break
        }
    }

    private func handleEvent(_ evt: GatewayEvent) async {
        broadcastEvent(evt)
        guard evt.event == "node.invoke.request" else { return }
        guard let payload = evt.payload else { return }

        do {
            let data = try encoder.encode(payload)
            let request = try decoder.decode(NodeInvokeRequestPayload.self, from: data)
            logger.info("node invoke id=\(request.id, privacy: .public) cmd=\(request.command, privacy: .public)")

            guard let onInvoke else { return }
            let req = BridgeInvokeRequest(id: request.id, command: request.command, paramsJSON: request.paramsJSON)
            let response = await Self.invokeWithTimeout(request: req, timeoutMs: request.timeoutMs, onInvoke: onInvoke)
            await sendInvokeResult(request: request, response: response)
        } catch {
            logger.error("node invoke decode failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func sendInvokeResult(request: NodeInvokeRequestPayload, response: BridgeInvokeResponse) async {
        guard let ch = channel else { return }
        var params: [String: FlexValue] = [
            "id": .string(request.id),
            "nodeId": .string(request.nodeId),
            "ok": .bool(response.ok),
        ]
        if let json = response.payloadJSON { params["payloadJSON"] = .string(json) }
        if let err = response.error {
            params["error"] = .object(["code": .string(err.code), "message": .string(err.message)])
        }
        _ = try? await ch.request(method: "node.invoke.result", params: .object(params))
    }

    private func handleDisconnected(_ reason: String) async {
        resetConnectionState()
        await onDisconnected?(reason)
    }

    // MARK: - Private: Snapshot

    private func resetConnectionState() {
        hasNotifiedConnected = false; snapshotReceived = false
        drainSnapshotWaiters(returning: false)
    }

    private func markSnapshotReceived() {
        snapshotReceived = true; drainSnapshotWaiters(returning: true)
    }

    private func waitForSnapshot(timeoutMs: Int) async -> Bool {
        if snapshotReceived { return true }
        return await withCheckedContinuation { cont in
            snapshotWaiters.append(cont)
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(max(0, timeoutMs)) * 1_000_000)
                await self?.timeoutSnapshotWaiters()
            }
        }
    }

    private func timeoutSnapshotWaiters() {
        guard !snapshotReceived else { return }
        drainSnapshotWaiters(returning: false)
    }

    private func drainSnapshotWaiters(returning value: Bool) {
        let waiters = snapshotWaiters; snapshotWaiters.removeAll()
        for w in waiters { w.resume(returning: value) }
    }

    private func notifyConnectedIfNeeded() async {
        guard !hasNotifiedConnected else { return }
        hasNotifiedConnected = true
        await onConnected?()
    }

    // MARK: - Private: Event Broadcasting

    private func broadcastEvent(_ evt: GatewayEvent) {
        for (id, cont) in serverEventSubscribers {
            if case .terminated = cont.yield(evt) {
                serverEventSubscribers.removeValue(forKey: id)
            }
        }
    }

    private func removeSubscriber(_ id: UUID) {
        serverEventSubscribers.removeValue(forKey: id)
    }

    // MARK: - Private: Options Key

    private func optionsKey(_ options: GatewayConnectOptions) -> String {
        func sorted(_ vals: [String]) -> String {
            vals.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }.sorted().joined(separator: ",")
        }
        let perms = options.permissions.map { "\($0.key)=\($0.value ? "1" : "0")" }
            .sorted().joined(separator: ",")
        return [
            options.role, sorted(options.scopes), sorted(options.caps),
            sorted(options.commands), options.clientId, options.clientMode,
            options.clientDisplayName ?? "", options.includeDeviceIdentity ? "1" : "0", perms,
        ].joined(separator: "|")
    }
}
