import Foundation
import OSLog
import CoreBlowKit
import SwiftUI
import CoreBlowProtocol

// MARK: - Gateway Environment Extensions

extension GatewayEnvironment {
    static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }
    static var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
    }
}

// MARK: - Config Store Extensions

extension ConfigStore {
    var gatewayHost: String {
        get { "localhost" }
        set { }
    }
    var autoStart: Bool {
        get { true }
        set { }
    }
}

// MARK: - Session Data

struct SessionData: Codable, Sendable, Identifiable {
    var id: String
    var displayName: String?
    var agentId: String?
    var model: String?
    var createdAtMs: Int?
    var lastActiveMs: Int?
    var updatedAt: Date?
    var sessionKey: String?
    var name: String?
}

// MARK: - Channel Item

struct ChannelItem: Identifiable, Equatable, Codable {
    var id: String
    var name: String?
    var type: String
    var enabled: Bool
    var error: String?
}

// MARK: - Skill Types

struct SkillInstallResult: Codable {
    var ok: Bool
    var error: String?
    var message: String?
}

struct SkillUpdateResult: Codable {
    var ok: Bool
    var error: String?
}

// MARK: - Agent Deep Link

enum DeepLinkRoute: Sendable, Equatable {
    case agent(AgentDeepLink)
    case gateway(GatewayConnectDeepLink)
}

struct GatewayConnectDeepLink: Codable, Sendable, Equatable {
    let host: String
    let port: Int
    let tls: Bool
    let bootstrapToken: String?
    let token: String?
    let password: String?

    var websocketURL: URL? {
        let scheme = self.tls ? "wss" : "ws"
        return URL(string: "\(scheme)://\(self.host):\(self.port)")
    }

    static func fromSetupCode(_ code: String) -> GatewayConnectDeepLink? {
        guard let data = Self.decodeBase64Url(code) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let urlString = json["url"] as? String,
              let parsed = URLComponents(string: urlString),
              let hostname = parsed.host,
              !hostname.isEmpty
        else {
            return nil
        }

        let scheme = (parsed.scheme ?? "ws").lowercased()
        guard scheme == "ws" || scheme == "wss" else { return nil }
        let tls = scheme == "wss"
        if !tls, !LoopbackHost.isLoopback(hostname) {
            return nil
        }
        let port = parsed.port ?? (tls ? 443 : 18789)
        return GatewayConnectDeepLink(
            host: hostname,
            port: port,
            tls: tls,
            bootstrapToken: json["bootstrapToken"] as? String,
            token: json["token"] as? String,
            password: json["password"] as? String)
    }

    private static func decodeBase64Url(_ input: String) -> Data? {
        var base64 = input
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(contentsOf: String(repeating: "=", count: 4 - remainder))
        }
        return Data(base64Encoded: base64)
    }
}

struct AgentDeepLink: Codable, Sendable, Equatable {
    let message: String
    let sessionKey: String?
    let thinking: String?
    let deliver: Bool
    let to: String?
    let channel: String?
    let timeoutSeconds: Int?
    let key: String?
}

enum DeepLinkParser {
    static func parse(_ url: URL) -> DeepLinkRoute? {
        guard url.scheme?.lowercased() == "coreblow",
              let host = url.host?.lowercased(),
              !host.isEmpty,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            return nil
        }

        let query = (components.queryItems ?? []).reduce(into: [String: String]()) { values, item in
            guard let value = item.value else { return }
            values[item.name] = value
        }

        switch host {
        case "agent":
            guard let message = query["message"],
                  !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else {
                return nil
            }
            let deliver = (query["deliver"] as NSString?)?.boolValue ?? false
            let timeoutSeconds = query["timeoutSeconds"].flatMap { Int($0) }.flatMap { $0 >= 0 ? $0 : nil }
            return .agent(
                AgentDeepLink(
                    message: message,
                    sessionKey: query["sessionKey"],
                    thinking: query["thinking"],
                    deliver: deliver,
                    to: query["to"],
                    channel: query["channel"],
                    timeoutSeconds: timeoutSeconds,
                    key: query["key"]))

        case "gateway":
            guard let hostParam = query["host"],
                  !hostParam.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else {
                return nil
            }
            let port = query["port"].flatMap { Int($0) } ?? 18789
            let tls = (query["tls"] as NSString?)?.boolValue ?? false
            if !tls, !LoopbackHost.isLoopback(hostParam) {
                return nil
            }
            return .gateway(
                GatewayConnectDeepLink(
                    host: hostParam,
                    port: port,
                    tls: tls,
                    bootstrapToken: query["bootstrapToken"],
                    token: query["token"],
                    password: query["password"]))

        default:
            return nil
        }
    }
}

private extension URL {
    var queryItems: [String: String]? {
        guard let components = URLComponents(url: self, resolvingAgainstBaseURL: false),
              let items = components.queryItems else { return nil }
        return Dictionary(uniqueKeysWithValues: items.compactMap { item in
            guard let value = item.value else { return nil }
            return (item.name, value)
        })
    }
}

// MARK: - Location Types

enum CoreBlowLocationMode: String, Codable, CaseIterable {
    case off
    case coarse
    case precise
    case always
    case whileUsing
}

// LocationServiceCommon is defined as a protocol in CoreBlowKit/LocationServiceSupport.swift

// MARK: - Camera Types

struct CoreBlowCameraCommandPayload: Codable {
    var action: String
    var params: AnyCodable?
}

struct CoreBlowCameraSnapParams: Codable {
    var position: String?
    var resolution: String?
    var quality: Double?
    var maxWidth: Int?
    var format: CameraImageFormat?
    var facing: CameraFacing?
    var deviceId: String?
    var delayMs: Int?
}

struct CoreBlowCameraClipParams: Codable {
    var position: String?
    var durationMs: Int?
    var resolution: String?
    var includeAudio: Bool?
    var format: CameraVideoFormat?
    var facing: CameraFacing?
    var deviceId: String?
}

struct MacNodeScreenRecordParams: Codable {
    var durationMs: Int?
    var fps: Double?
    var screenIndex: Int?
    var includeAudio: Bool?
    var format: String?
}

// MARK: - System Run Types

struct CoreBlowSystemRunParams: Codable {
    var command: [String]
    var rawCommand: String?
    var cwd: String?
    var env: [String: String]?
    var timeoutMs: Int?
    var needsScreenRecording: Bool?
    var agentId: String?
    var sessionKey: String?
    var approved: Bool?
    var approvalDecision: String?
}

struct CoreBlowSystemWhichParams: Codable {
    var command: String
    var bins: [String]
}

// MARK: - Canvas Types

enum CoreBlowCanvasA2UIAction: Sendable {
    struct AgentMessageContext: Sendable {
        struct Session: Sendable {
            var key: String
            var surfaceId: String
        }

        struct Component: Sendable {
            var id: String
            var host: String
            var instanceId: String
        }

        var actionName: String
        var session: Session
        var component: Component
        var contextJSON: String?
    }

    static func extractActionName(_ userAction: [String: Any]) -> String? {
        for key in ["name", "action"] {
            if let raw = userAction[key] as? String {
                let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { return trimmed }
            }
        }
        return nil
    }

    static func sanitizeTagValue(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let nonEmpty = trimmed.isEmpty ? "-" : trimmed
        let normalized = nonEmpty.replacingOccurrences(of: " ", with: "_")
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.:")
        let scalars = normalized.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
        return String(scalars)
    }

    static func compactJSON(_ obj: Any?) -> String? {
        guard let obj else { return nil }
        guard JSONSerialization.isValidJSONObject(obj) else { return nil }
        guard let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
              let str = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return str
    }

    static func formatAgentMessage(_ context: AgentMessageContext) -> String {
        let ctxSuffix = context.contextJSON.flatMap { $0.isEmpty ? nil : " ctx=\($0)" } ?? ""
        return [
            "CANVAS_A2UI",
            "action=\(self.sanitizeTagValue(context.actionName))",
            "session=\(self.sanitizeTagValue(context.session.key))",
            "surface=\(self.sanitizeTagValue(context.session.surfaceId))",
            "component=\(self.sanitizeTagValue(context.component.id))",
            "host=\(self.sanitizeTagValue(context.component.host))",
            "instance=\(self.sanitizeTagValue(context.component.instanceId))\(ctxSuffix)",
            "default=update_canvas",
        ].joined(separator: " ")
    }

    static func jsDispatchA2UIActionStatus(actionId: String, ok: Bool, error: String?) -> String {
        let payload: [String: Any] = [
            "id": actionId,
            "ok": ok,
            "error": error ?? "",
        ]
        let json: String = {
            if let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
               let str = String(data: data, encoding: .utf8)
            {
                return str
            }
            return "{\"id\":\"\(actionId)\",\"ok\":\(ok ? "true" : "false"),\"error\":\"\"}"
        }()
        return """
        (() => {
          const detail = \(json);
          window.dispatchEvent(new CustomEvent('coreblow:a2ui-action-status', { detail }));
        })();
        """
    }
}

enum CoreBlowCanvasSnapshotFormat: String, Codable {
    case jpg
    case png
    case mp4
}

// MARK: - Capture Rate Limits

enum CaptureRateLimits {
    static func clampDurationMs(
        _ ms: Int?,
        defaultMs: Int = 10_000,
        minMs: Int = 250,
        maxMs: Int = 60_000) -> Int
    {
        let value = ms ?? defaultMs
        return min(maxMs, max(minMs, value))
    }

    static func clampFps(
        _ fps: Double?,
        defaultFps: Double = 10,
        minFps: Double = 1,
        maxFps: Double) -> Double
    {
        let value = fps ?? defaultFps
        guard value.isFinite else { return defaultFps }
        return min(maxFps, max(minFps, value))
    }
}

// MARK: - Network Interfaces

enum NetworkInterfaces {
    static func primaryIPv4Address() -> String? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
        defer { freeifaddrs(first) }
        var current: UnsafeMutablePointer<ifaddrs>? = first
        while let ifa = current {
            let family = ifa.pointee.ifa_addr.pointee.sa_family
            let name = String(cString: ifa.pointee.ifa_name)
            if family == UInt8(AF_INET), name == "en0" {
                var addr = ifa.pointee.ifa_addr.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee }
                var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                inet_ntop(AF_INET, &addr.sin_addr, &buffer, socklen_t(INET_ADDRSTRLEN))
                return String(cString: buffer)
            }
            current = ifa.pointee.ifa_next
        }
        return nil
    }
}

// MARK: - Gateway Health

let CoreBlowGatewayHealthOK = "ok"

// MARK: - Launchd Label

let gatewayLaunchdLabel = "ai.coreblow.gateway"

// MARK: - Onboarding

let onboardingVersionKey = "CoreBlowOnboardingVersion"

// MARK: - Deep Link Keys

let deepLinkKeyKey = "deepLinkKey"

// MARK: - AnyCodable Helpers

func anyCodableString(_ value: AnyCodable?) -> String? {
    guard let value else { return nil }
    if let str = value.value as? String { return str }
    return nil
}

func anyCodableBool(_ value: AnyCodable?) -> Bool? {
    guard let value else { return nil }
    if let b = value.value as? Bool { return b }
    return nil
}

func anyCodableArray(_ value: AnyCodable?) -> [AnyCodable]? {
    guard let value else { return nil }
    return value.value as? [AnyCodable]
}

func anyCodableEqual(_ a: AnyCodable?, _ b: AnyCodable?) -> Bool {
    if a == nil && b == nil { return true }
    guard let a, let b else { return false }
    return "\(a.value)" == "\(b.value)"
}

// MARK: - FlexValue overloads for OnboardingWizard compat
func anyCodableString(_ value: FlexValue?) -> String? {
    guard let value else { return nil }
    if case .string(let s) = value { return s }
    return nil
}

func anyCodableBool(_ value: FlexValue?) -> Bool? {
    guard let value else { return nil }
    if case .bool(let b) = value { return b }
    return nil
}

func anyCodableEqual(_ a: AnyCodable?, _ b: FlexValue?) -> Bool {
    anyCodableEqual(a, b?.asAnyCodable)
}

func anyCodableEqual(_ a: FlexValue?, _ b: AnyCodable?) -> Bool {
    anyCodableEqual(a?.asAnyCodable, b)
}

func anyCodableEqual(_ a: FlexValue?, _ b: FlexValue?) -> Bool {
    anyCodableEqual(a?.asAnyCodable, b?.asAnyCodable)
}

// MARK: - Wizard Step Helpers

func wizardStepType(_ step: WizardStep) -> String {
    switch step.type {
    case .string(let s): return s
    case .int(let i): return "\(i)"
    case .double(let d): return "\(d)"
    case .bool(let b): return b ? "true" : "false"
    default: return "unknown"
    }
}

func wizardStatusString(_ status: String) -> String {
    status
}

// WizardStep extensions for backward compatibility
extension WizardStep {
    var id: String { typeString }
    var initialvalue: FlexValue? { value }
    var message: String? { description }
    var placeholder: String? { nil }
    var sensitive: Bool? { nil }
    var executor: FlexValue? { nil }
}
