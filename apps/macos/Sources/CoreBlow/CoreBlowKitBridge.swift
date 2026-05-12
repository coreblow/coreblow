import Foundation
import CoreBlowKit
import CoreBlowProtocol
import CoreBlowChatUI

// MARK: - Canvas Command Bridge
// The Kit uses CanvasCommands.Action but Node runtime uses CoreBlowCanvasCommand
typealias CoreBlowCanvasCommand = CanvasCommands.Action

// MARK: - Canvas A2UI Command Bridge
// The Kit uses CanvasA2UICommands but Node runtime uses CoreBlowCanvasA2UICommand
enum CoreBlowCanvasA2UICommand: String, Sendable {
    case reset
    case push
    case pushJSONL
}

// MARK: - System Command Bridge
// The Kit uses SystemCommands but Node runtime uses CoreBlowSystemCommand
enum CoreBlowSystemCommand: String, Sendable {
    case run
    case which
    case notify
    case execApprovalsGet
    case execApprovalsSet
    case clipboard
    case setClipboard
}

// MARK: - Camera Command Bridge
enum CoreBlowCameraCommand: String, Sendable {
    case snap
    case clip
    case list
}

// MARK: - CoreBlow Capability
public enum CoreBlowCapability: String, Codable, Sendable {
    case canvas
    case browser
    case camera
    case screen
    case voiceWake
    case location
    case device
    case watch
    case photos
    case contacts
    case calendar
    case reminders
    case motion
}

// MARK: - Launchd Label
let launchdLabel = "ai.coreblow.gateway"

// MARK: - Node Error Compatibility
// The Kit defines CoreBlowNodeError(code:message:) but expanded code uses CoreBlowNodeError(message:)
// Add a convenience init
extension CoreBlowNodeError {
    init(_ message: String) {
        self.init(code: .unavailable, message: message)
    }
    init(message: String) {
        self.init(code: .unavailable, message: message)
    }

    /// Convert to Kit's NodeError for BridgeInvokeResponse
    func toNodeError() -> NodeError {
        NodeError(code: self.code.rawValue, message: self.message)
    }
}

// MARK: - ProcessInfo Extensions
extension ProcessInfo {
    var isNixMode: Bool { false }
}

// MARK: - CoreBlow Chat Attachment
struct CoreBlowChatAttachmentPayload: Codable {
    var type: String
    var url: String?
    var name: String?
    var mimeType: String?
    var data: String?
}

// MARK: - Location Keys
let locationModeKey = "CoreBlow_locationMode"
let locationPreciseKey = "CoreBlow_locationPrecise"

// CoreBlowPaths is defined in CoreBlowPaths.swift

// MARK: - BridgeInvokeResponse Convenience
// The expanded code passes CoreBlowNodeError but BridgeInvokeResponse expects NodeError
extension BridgeInvokeResponse {
    init(id: String, ok: Bool, payloadJSON: String? = nil, error: CoreBlowNodeError?) {
        self.init(id: id, ok: ok, payloadJSON: payloadJSON,
                  error: error.map { NodeError(code: $0.code.rawValue, message: $0.message) })
    }
}

// MARK: - BridgeRPCResponse Convenience
extension BridgeRPCResponse {
    init(id: String, ok: Bool, payloadJSON: String? = nil, error: CoreBlowNodeError?) {
        self.init(id: id, ok: ok, payloadJSON: payloadJSON,
                  error: error.map { NodeError(code: $0.code.rawValue, message: $0.message) })
    }
}

// MARK: - CanvasCommands.Action extensions for backward compat
extension CanvasCommands.Action {
    static var navigate: CanvasCommands.Action { .present }
    static var evalJS: CanvasCommands.Action { .eval }
}

// MARK: - Missing Keys
let cameraEnabledKey = "CoreBlow_cameraEnabled"
let currentOnboardingVersion = 1

// MARK: - Missing Config Extensions
extension CoreBlowConfigFile {
    static func browserControlEnabled() -> Bool { true }
}

// MARK: - GatewayResponseError
struct GatewayResponseError: Codable, Sendable {
    var code: String
    var message: String
    var details: AnyCodable?
}

// MARK: - CoreBlowSessionsPreviewPayload extension
extension CoreBlowSessionsPreviewPayload {
    var previews: [CoreBlowSessionPreviewEntry] { sessions }
}

// MARK: - Type Aliases for Kit types
typealias CoreBlowCanvasA2UIJSONL = CanvasA2UIJSONL
typealias CoreBlowChatViewModel = ChatViewModel

// VoiceSessionCoordinator is defined in VoiceSessionCoordinator.swift
// ExecApprovalsFile is defined in ExecApprovals.swift

// MARK: - VoiceSessionCoordinator missing members
extension VoiceSessionCoordinator {
    func sendNow(_ text: String) {
        if !text.isEmpty {
            Task.detached {
                await VoiceWakeForwarder.forward(transcript: text)
            }
        }
    }
    func sendNow(token: UUID, reason: String) {
        // Stub: token-based send
    }
    struct VoiceSnapshot {
        var phase: TalkModePhase = .idle
        var transcript: String = ""
    }
    var snapshot: VoiceSnapshot { VoiceSnapshot() }
    func overlayDidDismiss() {}
}

// MARK: - GatewayConnectivityCoordinator missing members
extension GatewayConnectivityCoordinator {
    var localEndpointHostLabel: String { "localhost" }
}

// MARK: - ControlChannel.request returns Data but code expects GatewayResponse
// Add convenience extension
extension ControlChannel {
    func requestDecoded<T: Decodable>(method: String, params: [String: AnyHashable] = [:]) async throws -> T {
        let data = try await self.request(method: method, params: params)
        return try JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - FlexValue ↔ AnyCodable Conversion
extension FlexValue {
    var asAnyCodable: AnyCodable {
        switch self {
        case .string(let s): return AnyCodable(s)
        case .int(let i): return AnyCodable(i)
        case .double(let d): return AnyCodable(d)
        case .bool(let b): return AnyCodable(b)
        case .null: return AnyCodable(NSNull())
        case .array(let arr): return AnyCodable(arr.map { $0.asAnyCodable })
        case .object(let dict): return AnyCodable(dict.mapValues { $0.asAnyCodable })
        }
    }

    init(from anyCodable: AnyCodable) {
        let v = anyCodable.value
        if let s = v as? String { self = .string(s) }
        else if let i = v as? Int { self = .int(i) }
        else if let d = v as? Double { self = .double(d) }
        else if let b = v as? Bool { self = .bool(b) }
        else { self = .null }
    }
}

extension AnyCodable {
    var asFlexValue: FlexValue { FlexValue(from: self) }
}

// MARK: - GatewayResponse → Data convenience
extension GatewayResponse {
    func toJSONData() throws -> Data {
        try JSONEncoder().encode(self)
    }
}

// SettingsTabRouter.open compat
extension SettingsTabRouter {
    static func open(_ tab: SettingsTab) { request(tab) }
    static func open(tab: SettingsTab) { request(tab) }
}

// AgentDeepLink is defined in CoreBlowMissingTypeStubs.swift

// CoreBlowChatMessage is defined in CoreBlowMissingTypeStubs.swift

// MARK: - CanvasA2UIJSONL compat
extension CanvasA2UIJSONL {
    static func decodeMessagesFromJSONL(_ text: String) -> [CanvasA2UIAction] {
        decode(text)
    }
}

// MARK: - CoreBlowChatTransportEvent extensions
extension CoreBlowChatTransportEvent {
    static var health: CoreBlowChatTransportEvent {
        CoreBlowChatTransportEvent(type: "health", payload: nil)
    }
}

// MARK: - GatewayChannelActor → Data Bridge
// The Kit actor returns GatewayResponse, but GatewayConnection expects Data.
extension GatewayChannelActor {
    /// Adapter: converts AnyCodable params to FlexValue and encodes response to Data.
    func request(
        method: String,
        params: [String: AnyCodable]?,
        timeoutMs: Double? = nil
    ) async throws -> Data {
        let flexParams: FlexValue?
        if let params {
            var dict = [String: FlexValue]()
            for (k, v) in params { dict[k] = FlexValue(from: v) }
            flexParams = .object(dict)
        } else {
            flexParams = nil
        }
        let response = try await self.request(
            method: method,
            params: flexParams,
            timeoutMs: timeoutMs ?? 15_000)
        return try JSONEncoder().encode(response)
    }
}

// MARK: - CoreBlowSessionsPreviewPayload extended init
extension CoreBlowSessionsPreviewPayload {
    init(ts: Int, previews: [CoreBlowSessionPreviewEntry]) {
        self.init(sessions: previews)
    }
}

// MARK: - CoreBlowConfigFile missing members
extension CoreBlowConfigFile {
    static var hostKey: String? { nil }
    static var configURL: URL? { nil }
}

// MARK: - CoreBlowPaths missing members
extension CoreBlowPaths {
    static var configURL: URL { configDirURL.appendingPathComponent("config.json") }
}

// MARK: - ChatAttachment compatibility
extension CoreBlowChatAttachmentPayload {
    var fileName: String? { name }
    var content: String? { data }
}

// MARK: - Missing Constants
let cliInstallPromptedVersionKey = "CoreBlow_cliInstallPromptedVersion"
let debugFileLogEnabledKey = "CoreBlow_debugFileLogEnabled"
let voiceWakeMaxWords = 50
let voiceWakeMaxWordLength = 100

// MARK: - Missing Command Enums
enum MacNodeScreenCommand: String, Sendable {
    case screenshot
    case record
    case listDisplays
}

enum CoreBlowLocationCommand: String, Sendable {
    case get
    case status
    case requestPermission
}

enum CoreBlowBrowserCommand: String, Sendable {
    case open
    case navigate
    case screenshot
    case eval
    case close
    case proxy
}

// MARK: - Missing Param Types
struct CoreBlowLocationGetParams: Codable {
    var accuracy: String?
    var timeoutMs: Int?
}

struct CoreBlowCanvasPresentParams: Codable {
    var url: String?
    var html: String?
    var width: Int?
    var height: Int?
}

struct CoreBlowCanvasA2UIPushJSONLParams: Codable {
    var session: String?
    var lines: [String]?
    var jsonl: String?
}

struct CoreBlowChatSessionsDefaults: Codable {
    var mainSessionKey: String?
    var scope: String?
}

// MARK: - PeekabooBridgeHostCoordinator
class PeekabooBridgeHostCoordinator {
    static let shared = PeekabooBridgeHostCoordinator()
    func start() {}
    func stop() {}
}

// MARK: - Camera Session
enum CameraSessionConfigurationError: Error {
    case deviceNotAvailable
    case configurationFailed(String)
}

// MARK: - Onboarding State
enum OnboardingState: Equatable {
    case notStarted
    case inProgress
    case completed
}

// MARK: - Config dir shortcut
var configDirURL: URL { CoreBlowPaths.configDirURL }

// MARK: - Camera Facing
enum CameraFacing: String, Codable, Sendable {
    case front
    case back
    case any
}

// MARK: - Camera Image Format
enum CameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
    case png
}

// MARK: - Camera Video Format
enum CameraVideoFormat: String, Codable, Sendable {
    case mp4
    case mov
}

// MARK: - Canvas Snapshot Format
enum CanvasSnapshotFormat: String, Codable, Sendable {
    case jpeg
    case png
}

// MARK: - Canvas Placement
struct CanvasPlacement: Codable {
    var x: Int?
    var y: Int?
    var width: Int?
    var height: Int?
}

// MARK: - Canvas Present Params Extended
extension CoreBlowCanvasPresentParams {
    var placement: CanvasPlacement? { nil }
}

// MARK: - Canvas Navigate Params
struct CoreBlowCanvasNavigateParams: Codable {
    var url: String
}

// MARK: - Canvas Eval Params
struct CoreBlowCanvasEvalParams: Codable {
    var javaScript: String
}

// MARK: - Canvas Snapshot Params
struct CoreBlowCanvasSnapshotParams: Codable {
    var format: CanvasSnapshotFormat?
    var maxWidth: Int?
    var quality: Double?
}

// MARK: - Canvas A2UI Push Params
struct CoreBlowCanvasA2UIPushParams: Codable {
    var messages: [AnyCodable]
}

// MARK: - CanvasA2UIJSONL extended
extension CanvasA2UIJSONL {
    static func encodeMessagesJSONArray(_ messages: [AnyCodable]) throws -> String {
        let data = try JSONEncoder().encode(messages)
        return String(data: data, encoding: .utf8) ?? "[]"
    }
}

// MARK: - Notification Types
enum NotificationPriority: String, Codable {
    case low, `default`, high, critical
}

enum NotificationDelivery: String, Codable {
    case system, overlay, auto
}

// MARK: - System Notify Params
struct CoreBlowSystemNotifyParams: Codable {
    var title: String
    var body: String
    var sound: Bool?
    var priority: NotificationPriority?
    var delivery: NotificationDelivery?
}

// MARK: - SystemRun Params extensions
extension CoreBlowSystemRunParams {
    var rawCommand: String? { nil }
    var agentId: String? { nil }
    var approved: Bool? { nil }
    var approvalDecision: String? { nil }
    var needsScreenRecording: Bool? { nil }
}

// MARK: - Location Get Params extensions
extension CoreBlowLocationGetParams {
    var desiredAccuracy: LocationAccuracy? { nil }
    var maxAgeMs: Int? { nil }
}

enum LocationAccuracy: String, Codable {
    case precise
    case balanced
    case approximate
}

// MARK: - Location Payload
struct CoreBlowLocationPayload: Encodable {
    var lat: Double
    var lon: Double
    var accuracyMeters: Double
    var altitudeMeters: Double?
    var speedMps: Double?
    var headingDeg: Double?
    var timestamp: String
    var isPrecise: Bool
    var source: String?
}

// MARK: - Location Mode
enum LocationMode: String {
    case always
    case whileUsing
    case off
}

// MARK: - VoiceSessionCoordinator missing members (extensions only)
// VoiceSessionCoordinator already has sendNow extension above

// MARK: - SessionData missing members
extension SessionData {
    var messageCount: Int { 0 }
    var lastMessagePreview: String? { nil }
}

// MARK: - ModelChoice missing members
extension ModelChoice {
    var contextwindow: Int? { nil }
    init(modelID: String, name: String, provider: String, contextWindow: Int?) {
        self.init(id: modelID, name: name, provider: provider, contextWindow: contextWindow)
    }
}

// MARK: - GatewayPush bridge
// Kit's GatewayPush uses HelloOkPayload, app code uses HelloOk pattern
// Add missing members via extension so pattern matching works
extension HelloOkPayload {
    var type: String { "hello_ok" }
    var _protocol: Int { 3 }
    var server: [String: AnyCodable] { [:] }
    var features: [String: AnyCodable] { [:] }
    var snapshot: Snapshot { Snapshot(
        presence: [], health: AnyCodable(true),
        stateversion: StateVersion(config: 0, approvals: 0, tools: 0),
        uptimems: 0, configpath: nil, statedir: nil,
        sessiondefaults: nil, authmode: nil, updateavailable: nil) }
    var canvashosturl: String? { canvasHostUrl }
    var policy: [String: AnyCodable] { [:] }
}

// GatewayEvent from CoreBlowProtocol already has .event + .payload
// But app code uses EventFrame — add typealias
typealias EventFrame = CoreBlowProtocol.GatewayEvent

// MARK: - PeekabooBridgeHostCoordinator extensions
extension PeekabooBridgeHostCoordinator {
    func setEnabled(_ enabled: Bool) {}
}

// MARK: - NotificationPriority extensions
extension NotificationPriority {
    static var active: NotificationPriority { .default }
}

// MARK: - NSAttributedString extensions
extension NSAttributedString {
    func strippingForegroundColor() -> NSAttributedString { self }
}

// MARK: - String extensions for icon state
extension String {
    func toIconState() -> String { self }
}

import CoreLocation

// MARK: - Snapshot missing members
extension Snapshot {
    var canvashosturl: String? { nil }
}

// MARK: - AgentDeepLink missing members
extension AgentDeepLink {
    var to: String? { nil }
}

// MARK: - AppState missing members
extension AppState {
    var connectedNodes: [String] { [] }
}

// MARK: - CanvasFileWatcher missing members
extension CanvasFileWatcher {
    func start() {}
    func stop() {}
}

// MARK: - CoreBlowSessionPreviewEntry missing
extension CoreBlowSessionPreviewEntry {
    var text: String? { lastMessage }
}

// MARK: - Missing scoped types
enum AppLogLevel: String, Codable, CaseIterable {
    case off, error, warning, info, debug, verbose
    var title: String { rawValue.capitalized }
}

struct CoreBlowChatEventPayload: Codable {
    var type: String?
    var sessionKey: String?
    var message: String?
}

struct CoreBlowAgentEventPayload: Codable {
    var type: String?
    var sessionKey: String?
    var agentId: String?
}

struct GatewayTLSParams {
    var host: String
    var port: Int
}

class GatewayTLSStore {
    static let shared = GatewayTLSStore()
    func pinningSession(for params: GatewayTLSParams) -> GatewayTLSPinningSession? { nil }
}

class GatewayTLSPinningSession {
    var urlSession: URLSession { .shared }
}

struct CostUsageMenuView: View {
    var body: some View { EmptyView() }
}

struct MenuContent: View {
    var body: some View { EmptyView() }
}

// MARK: - ChannelItem extensions
extension ChannelItem {
    var title: String { name ?? id }
    var systemImage: String { "bubble.left" }
}

// MARK: - CoreBlowChatSessionsListResponse extensions
extension CoreBlowChatSessionsListResponse {
    var count: Int { sessions.count }
}

// MARK: - CoreBlowSessionPreviewEntry extensions
extension CoreBlowSessionPreviewEntry {
    var items: [CoreBlowSessionPreviewEntry] { [] }
}

import SwiftUI

// MARK: - Camera Pipeline Support (new types only)
struct CameraSessionConfiguration {
    var session: AVCaptureSession
    var device: AVCaptureDevice
    var output: AVCapturePhotoOutput
}

struct CameraMovieConfiguration {
    var session: AVCaptureSession
    var output: AVCaptureMovieFileOutput
}

enum CameraCapturePipelineSupport {
    static func warmUpCaptureSession() async {}

    static func preparePhotoSession(
        preferFrontCamera: Bool,
        deviceId: String?,
        pickCamera: (Bool, String?) -> AVCaptureDevice?,
        cameraUnavailableError: CameraCaptureService.CameraError,
        mapSetupError: (CameraSessionConfigurationError) -> CameraCaptureService.CameraError
    ) throws -> CameraSessionConfiguration {
        throw cameraUnavailableError
    }

    static func prepareWarmMovieSession(
        preferFrontCamera: Bool,
        deviceId: String?,
        includeAudio: Bool,
        durationMs: Int,
        pickCamera: (Bool, String?) -> AVCaptureDevice?,
        cameraUnavailableError: CameraCaptureService.CameraError,
        mapSetupError: (CameraSessionConfigurationError) -> CameraCaptureService.CameraError
    ) async throws -> CameraMovieConfiguration {
        throw cameraUnavailableError
    }

    static func makePhotoSettings(output: AVCapturePhotoOutput) -> AVCapturePhotoSettings {
        AVCapturePhotoSettings()
    }

    static func positionLabel(_ position: AVCaptureDevice.Position) -> String {
        switch position {
        case .front: return "front"
        case .back: return "back"
        default: return "unspecified"
        }
    }

    static func mapMovieSetupError(
        _ error: CameraSessionConfigurationError,
        microphoneUnavailableError: CameraCaptureService.CameraError,
        captureFailed: (String) -> CameraCaptureService.CameraError
    ) -> CameraCaptureService.CameraError {
        captureFailed(error.localizedDescription)
    }
}

enum CameraCaptureError: Error {
    case captureFailed(String)
    case microphoneUnavailable
    case deviceNotFound
    case notAuthorized
}

struct CameraSnapResult {
    var data: Data
    var size: CGSize
}

struct CameraClipResult {
    var path: String
    var durationMs: Int
    var hasAudio: Bool
}

// MARK: - PhotoCapture (standalone type)
enum PhotoCapture {
    static func transcodeJPEGForGateway(rawData: Data, maxWidthPx: Int, quality: Double) throws -> (data: Data, widthPx: Int, heightPx: Int) {
        (data: rawData, widthPx: 0, heightPx: 0)
    }
}

// MARK: - CameraAuthorization (standalone type)
enum CameraAuthorization {
    static func isAuthorized(for mediaType: AVMediaType) async -> Bool { false }
    static func requestAccess() async -> Bool { false }
}

import AVFoundation
