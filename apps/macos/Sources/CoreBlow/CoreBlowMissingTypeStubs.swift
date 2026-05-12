import Foundation
import OSLog
import CoreBlowKit
import OSLog
import SwiftUI
import CoreBlowKit
import CoreBlowProtocol

// MARK: - CoreBlow Config File Extensions

extension CoreBlowConfigFile {
    static func loadDict() -> [String: Any] {
        guard let data = try? Data(contentsOf: configFile),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return dict
    }

    static func saveDict(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted) else { return }
        try? data.write(to: configFile, options: .atomic)
    }

    static var gatewayPort: Int {
        let dict = loadDict()
        if let gw = dict["gateway"] as? [String: Any],
           let port = gw["port"] as? Int { return port }
        return 3000
    }

    static var defaultWorkspaceURL: URL? {
        let dict = loadDict()
        guard let ws = dict["workspace"] as? String else { return nil }
        return URL(fileURLWithPath: ws)
    }

    static func setRemoteGatewayUrl(_ url: String?) {
        var dict = loadDict()
        var gw = dict["gateway"] as? [String: Any] ?? [:]
        gw["remoteUrl"] = url
        dict["gateway"] = gw
        saveDict(dict)
    }

    static func clearRemoteGatewayUrl() {
        setRemoteGatewayUrl(nil)
    }

    private static var configFile: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return appSupport.appendingPathComponent("CoreBlow").appendingPathComponent("config.json")
    }
}

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

// MARK: - WebSocket Session Box

struct WebSocketSessionBox: Identifiable {
    var id: String
    var sessionKey: String
    var displayName: String?
}

// MARK: - Core Blow Chat Types

struct CoreBlowChatMessage: Identifiable, Equatable, Codable {
    var id: String
    var role: String
    var content: String
    var timestamp: Date
    var toolName: String?
    var isError: Bool = false
}

struct CoreBlowChatSendResponse: Codable {
    var ok: Bool
    var error: String?
}

struct CoreBlowChatHistoryPayload: Codable {
    var messages: [CoreBlowChatMessage]?
}

struct CoreBlowSessionsPreviewPayload: Codable {
    var sessions: [CoreBlowSessionPreviewEntry]
}

struct CoreBlowSessionPreviewEntry: Codable, Identifiable {
    var id: String
    var title: String?
    var lastMessage: String?
    var updatedAt: Int?
    var status: String?
    var key: String?
    var messageCount: Int?
    var lastMessagePreview: String?
}

struct CoreBlowChatSessionsListResponse: Codable {
    var sessions: [SessionData]
    var ts: Int?
    var path: String?
    var defaults: CoreBlowChatSessionsDefaults?
}

// MARK: - CoreBlow Chat View

struct CoreBlowChatView: View {
    var sessionKey: String
    var body: some View {
        Text("Chat: \(sessionKey)")
    }
}

protocol CoreBlowChatTransport {
    var sessionKey: String { get }
    func send(message: String, thinking: String, attachments: [CoreBlowChatAttachmentPayload]) async throws -> CoreBlowChatSendResponse
}

enum CoreBlowChatTransportEvent: Equatable {
    case health(ok: Bool)
    case tick
    case chat(CoreBlowChatEventPayload)
    case agent(CoreBlowAgentEventPayload)
    case seqGap

    static func == (lhs: CoreBlowChatTransportEvent, rhs: CoreBlowChatTransportEvent) -> Bool {
        switch (lhs, rhs) {
        case (.tick, .tick), (.seqGap, .seqGap): return true
        case let (.health(a), .health(b)): return a == b
        default: return false
        }
    }
}

typealias CoreBlowChatModelChoice = ModelChoice

// PresenceEntry is defined in GatewayModels.swift

// MARK: - Talk Mode Phase

enum TalkModePhase: String, Equatable {
    case idle
    case listening
    case thinking
    case speaking
    case error
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

struct AgentDeepLink: Equatable {
    var agentId: String?
    var sessionKey: String?
    var message: String?
    var key: String? { sessionKey }
}

enum DeepLinkParser {
    static func parse(_ url: URL) -> AgentDeepLink? {
        guard url.scheme == "coreblow" else { return nil }
        return AgentDeepLink(
            agentId: url.queryItems?["agentId"],
            sessionKey: url.queryItems?["sessionKey"],
            message: url.queryItems?["message"])
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

enum CoreBlowLocationAccuracy: String, Codable {
    case best
    case nearestTenMeters
    case hundredMeters
    case kilometer
    case threeKilometers
}

struct LocationServiceCommon {
    static var isAuthorized: Bool { false }
}

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
    var fps: Int?
    var screenIndex: Int?
    var includeAudio: Bool?
    var format: String?
}

// MARK: - System Run Types

struct CoreBlowSystemRunParams: Codable {
    var command: String
    var args: [String]?
    var cwd: String?
    var timeoutMs: Int?
    var sessionKey: String?
    var env: [String: String]?
}

struct CoreBlowSystemWhichParams: Codable {
    var command: String
    var bins: [String]
}

// MARK: - Canvas Types

enum CoreBlowCanvasA2UIAction: String, Codable {
    case show
    case hide
    case eval
    case snapshot
}

enum CoreBlowCanvasSnapshotFormat: String, Codable {
    case jpg
    case png
    case mp4
}

// MARK: - Capture Rate Limits

enum CaptureRateLimits {
    static func clampFps(_ fps: Int) -> Int {
        max(1, min(30, fps))
    }
    static func clampDurationMs(_ ms: Int) -> Int {
        max(500, min(60_000, ms))
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

// ExecApprovalsSnapshot is defined in GatewayModels.swift

// MARK: - Gateway Health

let CoreBlowGatewayHealthOK = "ok"

// MARK: - Launchd Label

let gatewayLaunchdLabel = "ai.coreblow.gateway"

// MARK: - Onboarding

let onboardingVersionKey = "CoreBlowOnboardingVersion"

// ConnectionMode is defined in AppState.swift

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


// InstanceIdentity is provided by CoreBlowKit (Identity/InstanceIdentity.swift)

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

// NodeError and CoreBlowNodeError are provided by CoreBlowKit (NodeError.swift)
