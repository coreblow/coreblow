import Foundation

// MARK: - Capability and settings compatibility

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

public enum CoreBlowLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}

public struct CoreBlowDateRangeLimitParams: Codable, Sendable, Equatable {
    public var startISO: String?
    public var endISO: String?
    public var limit: Int?

    public init(startISO: String? = nil, endISO: String? = nil, limit: Int? = nil) {
        self.startISO = startISO
        self.endISO = endISO
        self.limit = limit
    }
}

// MARK: - Canvas commands

public enum CoreBlowCanvasCommand: String, Codable, Sendable {
    case present = "canvas.present"
    case hide = "canvas.hide"
    case navigate = "canvas.navigate"
    case evalJS = "canvas.eval"
    case snapshot = "canvas.snapshot"
}

public enum CoreBlowCanvasA2UICommand: String, Codable, Sendable {
    case push = "canvas.a2ui.push"
    case pushJSONL = "canvas.a2ui.pushJSONL"
    case reset = "canvas.a2ui.reset"
}

public struct CoreBlowCanvasA2UIPushParams: Codable, Sendable, Equatable {
    public var messages: [AnyCodable]

    public init(messages: [AnyCodable]) {
        self.messages = messages
    }
}

public struct CoreBlowCanvasA2UIPushJSONLParams: Codable, Sendable, Equatable {
    public var jsonl: String

    public init(jsonl: String) {
        self.jsonl = jsonl
    }
}

public struct CoreBlowCanvasNavigateParams: Codable, Sendable, Equatable {
    public var url: String

    public init(url: String) {
        self.url = url
    }
}

public struct CoreBlowCanvasPlacement: Codable, Sendable, Equatable {
    public var x: Double?
    public var y: Double?
    public var width: Double?
    public var height: Double?

    public init(x: Double? = nil, y: Double? = nil, width: Double? = nil, height: Double? = nil) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

public struct CoreBlowCanvasPresentParams: Codable, Sendable, Equatable {
    public var url: String?
    public var placement: CoreBlowCanvasPlacement?

    public init(url: String? = nil, placement: CoreBlowCanvasPlacement? = nil) {
        self.url = url
        self.placement = placement
    }
}

public struct CoreBlowCanvasEvalParams: Codable, Sendable, Equatable {
    public var javaScript: String

    public init(javaScript: String) {
        self.javaScript = javaScript
    }
}

public enum CoreBlowCanvasSnapshotFormat: String, Codable, Sendable {
    case png
    case jpeg

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        switch raw {
        case "png":
            self = .png
        case "jpeg", "jpg":
            self = .jpeg
        default:
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid snapshot format: \(raw)")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(self.rawValue)
    }
}

public struct CoreBlowCanvasSnapshotParams: Codable, Sendable, Equatable {
    public var maxWidth: Int?
    public var quality: Double?
    public var format: CoreBlowCanvasSnapshotFormat?

    public init(maxWidth: Int? = nil, quality: Double? = nil, format: CoreBlowCanvasSnapshotFormat? = nil) {
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
    }
}

public enum CoreBlowCanvasA2UIAction: Sendable {
    public struct AgentMessageContext: Sendable {
        public struct Session: Sendable {
            public var key: String
            public var surfaceId: String

            public init(key: String, surfaceId: String) {
                self.key = key
                self.surfaceId = surfaceId
            }
        }

        public struct Component: Sendable {
            public var id: String
            public var host: String
            public var instanceId: String

            public init(id: String, host: String, instanceId: String) {
                self.id = id
                self.host = host
                self.instanceId = instanceId
            }
        }

        public var actionName: String
        public var session: Session
        public var component: Component
        public var contextJSON: String?

        public init(actionName: String, session: Session, component: Component, contextJSON: String?) {
            self.actionName = actionName
            self.session = session
            self.component = component
            self.contextJSON = contextJSON
        }
    }

    public static func extractActionName(_ userAction: [String: Any]) -> String? {
        for key in ["name", "action"] {
            if let raw = userAction[key] as? String {
                let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { return trimmed }
            }
        }
        return nil
    }

    public static func sanitizeTagValue(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let nonEmpty = trimmed.isEmpty ? "-" : trimmed
        let normalized = nonEmpty.replacingOccurrences(of: " ", with: "_")
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.:")
        let scalars = normalized.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" }
        return String(scalars)
    }

    public static func compactJSON(_ object: Any?) -> String? {
        guard let object else { return nil }
        guard JSONSerialization.isValidJSONObject(object) else { return nil }
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: []) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public static func formatAgentMessage(_ context: AgentMessageContext) -> String {
        let contextSuffix = context.contextJSON.flatMap { $0.isEmpty ? nil : " ctx=\($0)" } ?? ""
        return [
            "CANVAS_A2UI",
            "action=\(self.sanitizeTagValue(context.actionName))",
            "session=\(self.sanitizeTagValue(context.session.key))",
            "surface=\(self.sanitizeTagValue(context.session.surfaceId))",
            "component=\(self.sanitizeTagValue(context.component.id))",
            "host=\(self.sanitizeTagValue(context.component.host))",
            "instance=\(self.sanitizeTagValue(context.component.instanceId))\(contextSuffix)",
            "default=update_canvas",
        ].joined(separator: " ")
    }

    public static func jsDispatchA2UIActionStatus(actionId: String, ok: Bool, error: String?) -> String {
        let payload: [String: Any] = [
            "id": actionId,
            "ok": ok,
            "error": error ?? "",
        ]
        let json: String = {
            if let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
               let string = String(data: data, encoding: .utf8)
            {
                return string
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

// MARK: - Camera commands

public enum CoreBlowCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum CoreBlowCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum CoreBlowCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum CoreBlowCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct CoreBlowCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: CoreBlowCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: CoreBlowCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: CoreBlowCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: CoreBlowCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct CoreBlowCameraClipParams: Codable, Sendable, Equatable {
    public var facing: CoreBlowCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: CoreBlowCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: CoreBlowCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: CoreBlowCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}

// MARK: - Screen and system commands

public enum CoreBlowScreenCommand: String, Codable, Sendable {
    case record = "screen.record"
}

public struct CoreBlowScreenRecordParams: Codable, Sendable, Equatable {
    public var screenIndex: Int?
    public var durationMs: Int?
    public var fps: Double?
    public var format: String?
    public var includeAudio: Bool?

    public init(
        screenIndex: Int? = nil,
        durationMs: Int? = nil,
        fps: Double? = nil,
        format: String? = nil,
        includeAudio: Bool? = nil)
    {
        self.screenIndex = screenIndex
        self.durationMs = durationMs
        self.fps = fps
        self.format = format
        self.includeAudio = includeAudio
    }
}

public enum CoreBlowNotificationPriority: String, Codable, Sendable {
    case passive
    case active
    case timeSensitive
}

public enum CoreBlowNotificationDelivery: String, Codable, Sendable {
    case system
    case overlay
    case auto
}

public struct CoreBlowSystemRunParams: Codable, Sendable, Equatable {
    public var command: [String]
    public var rawCommand: String?
    public var cwd: String?
    public var env: [String: String]?
    public var timeoutMs: Int?
    public var needsScreenRecording: Bool?
    public var agentId: String?
    public var sessionKey: String?
    public var approved: Bool?
    public var approvalDecision: String?

    public init(
        command: [String],
        rawCommand: String? = nil,
        cwd: String? = nil,
        env: [String: String]? = nil,
        timeoutMs: Int? = nil,
        needsScreenRecording: Bool? = nil,
        agentId: String? = nil,
        sessionKey: String? = nil,
        approved: Bool? = nil,
        approvalDecision: String? = nil)
    {
        self.command = command
        self.rawCommand = rawCommand
        self.cwd = cwd
        self.env = env
        self.timeoutMs = timeoutMs
        self.needsScreenRecording = needsScreenRecording
        self.agentId = agentId
        self.sessionKey = sessionKey
        self.approved = approved
        self.approvalDecision = approvalDecision
    }
}

public struct CoreBlowSystemWhichParams: Codable, Sendable, Equatable {
    public var bins: [String]

    public init(bins: [String]) {
        self.bins = bins
    }
}

public struct CoreBlowSystemNotifyParams: Codable, Sendable, Equatable {
    public var title: String
    public var body: String
    public var sound: String?
    public var priority: CoreBlowNotificationPriority?
    public var delivery: CoreBlowNotificationDelivery?

    public init(
        title: String,
        body: String,
        sound: String? = nil,
        priority: CoreBlowNotificationPriority? = nil,
        delivery: CoreBlowNotificationDelivery? = nil)
    {
        self.title = title
        self.body = body
        self.sound = sound
        self.priority = priority
        self.delivery = delivery
    }
}

public extension CoreBlowSystemCommand {
    static var run: CoreBlowSystemCommand { .executeCommand }
    static var which: CoreBlowSystemCommand { .resolveBinary }
    static var notify: CoreBlowSystemCommand { .displayNotification }
    static var execApprovalsGet: CoreBlowSystemCommand { .fetchApprovals }
    static var execApprovalsSet: CoreBlowSystemCommand { .storeApprovals }
}

// MARK: - Chat and talk commands

public enum CoreBlowChatCommand: String, Codable, Sendable {
    case push = "chat.push"
}

public struct CoreBlowChatPushParams: Codable, Sendable, Equatable {
    public var text: String
    public var speak: Bool?

    public init(text: String, speak: Bool? = nil) {
        self.text = text
        self.speak = speak
    }
}

public struct CoreBlowChatPushPayload: Codable, Sendable, Equatable {
    public var messageId: String?

    public init(messageId: String? = nil) {
        self.messageId = messageId
    }
}

public enum CoreBlowTalkCommand: String, Codable, Sendable {
    case pttStart = "talk.ptt.start"
    case pttStop = "talk.ptt.stop"
    case pttCancel = "talk.ptt.cancel"
    case pttOnce = "talk.ptt.once"
}

public struct CoreBlowTalkPTTStartPayload: Codable, Sendable, Equatable {
    public var captureId: String

    public init(captureId: String) {
        self.captureId = captureId
    }
}

public struct CoreBlowTalkPTTStopPayload: Codable, Sendable, Equatable {
    public var captureId: String
    public var transcript: String?
    public var status: String

    public init(captureId: String, transcript: String?, status: String) {
        self.captureId = captureId
        self.transcript = transcript
        self.status = status
    }
}

// MARK: - Device and Watch commands

public enum CoreBlowDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum CoreBlowBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum CoreBlowThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum CoreBlowNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum CoreBlowNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct CoreBlowBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: CoreBlowBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: CoreBlowBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct CoreBlowThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: CoreBlowThermalState

    public init(state: CoreBlowThermalState) {
        self.state = state
    }
}

public struct CoreBlowStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct CoreBlowNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: CoreBlowNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [CoreBlowNetworkInterfaceType]

    public init(
        status: CoreBlowNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [CoreBlowNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct CoreBlowDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: CoreBlowBatteryStatusPayload
    public var thermal: CoreBlowThermalStatusPayload
    public var storage: CoreBlowStorageStatusPayload
    public var network: CoreBlowNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: CoreBlowBatteryStatusPayload,
        thermal: CoreBlowThermalStatusPayload,
        storage: CoreBlowStorageStatusPayload,
        network: CoreBlowNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct CoreBlowDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}

public enum CoreBlowWatchCommand: String, Codable, Sendable {
    case status = "watch.status"
    case notify = "watch.notify"
}

public enum CoreBlowWatchRisk: String, Codable, Sendable, Equatable {
    case low
    case medium
    case high
}

public struct CoreBlowWatchAction: Codable, Sendable, Equatable {
    public var id: String
    public var label: String
    public var style: String?

    public init(id: String, label: String, style: String? = nil) {
        self.id = id
        self.label = label
        self.style = style
    }
}

public struct CoreBlowWatchStatusPayload: Codable, Sendable, Equatable {
    public var supported: Bool
    public var paired: Bool
    public var appInstalled: Bool
    public var reachable: Bool
    public var activationState: String

    public init(supported: Bool, paired: Bool, appInstalled: Bool, reachable: Bool, activationState: String) {
        self.supported = supported
        self.paired = paired
        self.appInstalled = appInstalled
        self.reachable = reachable
        self.activationState = activationState
    }
}

public struct CoreBlowWatchNotifyParams: Codable, Sendable, Equatable {
    public var title: String
    public var body: String
    public var priority: CoreBlowNotificationPriority?
    public var promptId: String?
    public var sessionKey: String?
    public var kind: String?
    public var details: String?
    public var expiresAtMs: Int?
    public var risk: CoreBlowWatchRisk?
    public var actions: [CoreBlowWatchAction]?

    public init(
        title: String,
        body: String,
        priority: CoreBlowNotificationPriority? = nil,
        promptId: String? = nil,
        sessionKey: String? = nil,
        kind: String? = nil,
        details: String? = nil,
        expiresAtMs: Int? = nil,
        risk: CoreBlowWatchRisk? = nil,
        actions: [CoreBlowWatchAction]? = nil)
    {
        self.title = title
        self.body = body
        self.priority = priority
        self.promptId = promptId
        self.sessionKey = sessionKey
        self.kind = kind
        self.details = details
        self.expiresAtMs = expiresAtMs
        self.risk = risk
        self.actions = actions
    }
}

public struct CoreBlowWatchNotifyPayload: Codable, Sendable, Equatable {
    public var deliveredImmediately: Bool
    public var queuedForDelivery: Bool
    public var transport: String

    public init(deliveredImmediately: Bool, queuedForDelivery: Bool, transport: String) {
        self.deliveredImmediately = deliveredImmediately
        self.queuedForDelivery = queuedForDelivery
        self.transport = transport
    }
}

// MARK: - Photos, Contacts, Calendar, Reminders, Motion

public enum CoreBlowPhotosCommand: String, Codable, Sendable {
    case latest = "photos.latest"
}

public struct CoreBlowPhotosLatestParams: Codable, Sendable, Equatable {
    public var limit: Int?
    public var maxWidth: Int?
    public var quality: Double?

    public init(limit: Int? = nil, maxWidth: Int? = nil, quality: Double? = nil) {
        self.limit = limit
        self.maxWidth = maxWidth
        self.quality = quality
    }
}

public struct CoreBlowPhotoPayload: Codable, Sendable, Equatable {
    public var format: String
    public var base64: String
    public var width: Int
    public var height: Int
    public var createdAt: String?

    public init(format: String, base64: String, width: Int, height: Int, createdAt: String? = nil) {
        self.format = format
        self.base64 = base64
        self.width = width
        self.height = height
        self.createdAt = createdAt
    }
}

public struct CoreBlowPhotosLatestPayload: Codable, Sendable, Equatable {
    public var photos: [CoreBlowPhotoPayload]

    public init(photos: [CoreBlowPhotoPayload]) {
        self.photos = photos
    }
}

public enum CoreBlowContactsCommand: String, Codable, Sendable {
    case search = "contacts.search"
    case add = "contacts.add"
}

public struct CoreBlowContactsSearchParams: Codable, Sendable, Equatable {
    public var query: String?
    public var limit: Int?

    public init(query: String? = nil, limit: Int? = nil) {
        self.query = query
        self.limit = limit
    }
}

public struct CoreBlowContactsAddParams: Codable, Sendable, Equatable {
    public var givenName: String?
    public var familyName: String?
    public var organizationName: String?
    public var displayName: String?
    public var phoneNumbers: [String]?
    public var emails: [String]?

    public init(
        givenName: String? = nil,
        familyName: String? = nil,
        organizationName: String? = nil,
        displayName: String? = nil,
        phoneNumbers: [String]? = nil,
        emails: [String]? = nil)
    {
        self.givenName = givenName
        self.familyName = familyName
        self.organizationName = organizationName
        self.displayName = displayName
        self.phoneNumbers = phoneNumbers
        self.emails = emails
    }
}

public struct CoreBlowContactPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var displayName: String
    public var givenName: String
    public var familyName: String
    public var organizationName: String
    public var phoneNumbers: [String]
    public var emails: [String]

    public init(
        identifier: String,
        displayName: String,
        givenName: String,
        familyName: String,
        organizationName: String,
        phoneNumbers: [String],
        emails: [String])
    {
        self.identifier = identifier
        self.displayName = displayName
        self.givenName = givenName
        self.familyName = familyName
        self.organizationName = organizationName
        self.phoneNumbers = phoneNumbers
        self.emails = emails
    }
}

public struct CoreBlowContactsSearchPayload: Codable, Sendable, Equatable {
    public var contacts: [CoreBlowContactPayload]

    public init(contacts: [CoreBlowContactPayload]) {
        self.contacts = contacts
    }
}

public struct CoreBlowContactsAddPayload: Codable, Sendable, Equatable {
    public var contact: CoreBlowContactPayload

    public init(contact: CoreBlowContactPayload) {
        self.contact = contact
    }
}

public enum CoreBlowCalendarCommand: String, Codable, Sendable {
    case events = "calendar.events"
    case add = "calendar.add"
}

public typealias CoreBlowCalendarEventsParams = CoreBlowDateRangeLimitParams

public struct CoreBlowCalendarAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var startISO: String
    public var endISO: String
    public var isAllDay: Bool?
    public var location: String?
    public var notes: String?
    public var calendarId: String?
    public var calendarTitle: String?

    public init(
        title: String,
        startISO: String,
        endISO: String,
        isAllDay: Bool? = nil,
        location: String? = nil,
        notes: String? = nil,
        calendarId: String? = nil,
        calendarTitle: String? = nil)
    {
        self.title = title
        self.startISO = startISO
        self.endISO = endISO
        self.isAllDay = isAllDay
        self.location = location
        self.notes = notes
        self.calendarId = calendarId
        self.calendarTitle = calendarTitle
    }
}

public struct CoreBlowCalendarEventPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var startISO: String
    public var endISO: String
    public var isAllDay: Bool
    public var location: String?
    public var calendarTitle: String?

    public init(
        identifier: String,
        title: String,
        startISO: String,
        endISO: String,
        isAllDay: Bool,
        location: String? = nil,
        calendarTitle: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.startISO = startISO
        self.endISO = endISO
        self.isAllDay = isAllDay
        self.location = location
        self.calendarTitle = calendarTitle
    }
}

public struct CoreBlowCalendarEventsPayload: Codable, Sendable, Equatable {
    public var events: [CoreBlowCalendarEventPayload]

    public init(events: [CoreBlowCalendarEventPayload]) {
        self.events = events
    }
}

public struct CoreBlowCalendarAddPayload: Codable, Sendable, Equatable {
    public var event: CoreBlowCalendarEventPayload

    public init(event: CoreBlowCalendarEventPayload) {
        self.event = event
    }
}

public enum CoreBlowRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum CoreBlowReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct CoreBlowRemindersListParams: Codable, Sendable, Equatable {
    public var status: CoreBlowReminderStatusFilter?
    public var limit: Int?

    public init(status: CoreBlowReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct CoreBlowRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct CoreBlowReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(identifier: String, title: String, dueISO: String? = nil, completed: Bool, listName: String? = nil) {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct CoreBlowRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [CoreBlowReminderPayload]

    public init(reminders: [CoreBlowReminderPayload]) {
        self.reminders = reminders
    }
}

public struct CoreBlowRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: CoreBlowReminderPayload

    public init(reminder: CoreBlowReminderPayload) {
        self.reminder = reminder
    }
}

public enum CoreBlowMotionCommand: String, Codable, Sendable {
    case activity = "motion.activity"
    case pedometer = "motion.pedometer"
}

public typealias CoreBlowMotionActivityParams = CoreBlowDateRangeLimitParams

public struct CoreBlowMotionActivityEntry: Codable, Sendable, Equatable {
    public var startISO: String
    public var endISO: String
    public var confidence: String
    public var isWalking: Bool
    public var isRunning: Bool
    public var isCycling: Bool
    public var isAutomotive: Bool
    public var isStationary: Bool
    public var isUnknown: Bool

    public init(
        startISO: String,
        endISO: String,
        confidence: String,
        isWalking: Bool,
        isRunning: Bool,
        isCycling: Bool,
        isAutomotive: Bool,
        isStationary: Bool,
        isUnknown: Bool)
    {
        self.startISO = startISO
        self.endISO = endISO
        self.confidence = confidence
        self.isWalking = isWalking
        self.isRunning = isRunning
        self.isCycling = isCycling
        self.isAutomotive = isAutomotive
        self.isStationary = isStationary
        self.isUnknown = isUnknown
    }
}

public struct CoreBlowMotionActivityPayload: Codable, Sendable, Equatable {
    public var activities: [CoreBlowMotionActivityEntry]

    public init(activities: [CoreBlowMotionActivityEntry]) {
        self.activities = activities
    }
}

public struct CoreBlowPedometerParams: Codable, Sendable, Equatable {
    public var startISO: String?
    public var endISO: String?

    public init(startISO: String? = nil, endISO: String? = nil) {
        self.startISO = startISO
        self.endISO = endISO
    }
}

public struct CoreBlowPedometerPayload: Codable, Sendable, Equatable {
    public var startISO: String
    public var endISO: String
    public var steps: Int?
    public var distanceMeters: Double?
    public var floorsAscended: Int?
    public var floorsDescended: Int?

    public init(
        startISO: String,
        endISO: String,
        steps: Int?,
        distanceMeters: Double?,
        floorsAscended: Int?,
        floorsDescended: Int?)
    {
        self.startISO = startISO
        self.endISO = endISO
        self.steps = steps
        self.distanceMeters = distanceMeters
        self.floorsAscended = floorsAscended
        self.floorsDescended = floorsDescended
    }
}
