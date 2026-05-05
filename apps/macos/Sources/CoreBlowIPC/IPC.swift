import CoreGraphics
import Foundation

// MARK: - Capabilities

public enum Capability: String, Codable, CaseIterable, Sendable {
    case appleScript
    case notifications
    case accessibility
    case screenRecording
    case microphone
    case speechRecognition
    case camera
    case location
}

public enum CameraFacing: String, Codable, Sendable {
    case front
    case back
}

// MARK: - Notification

public enum NotificationPriority: String, Codable, Sendable {
    case passive
    case active
    case timeSensitive
}

public enum NotificationDelivery: String, Codable, Sendable {
    case system
    case overlay
    case auto
}

// MARK: - Canvas

public struct CanvasPlacement: Codable, Sendable {
    public var x: Double?
    public var y: Double?
    public var width: Double?
    public var height: Double?
    public init(x: Double? = nil, y: Double? = nil, width: Double? = nil, height: Double? = nil) {
        self.x = x; self.y = y; self.width = width; self.height = height
    }
}

public enum CanvasShowStatus: String, Codable, Sendable {
    case shown, web, ok, notFound, welcome
}

public struct CanvasShowResult: Codable, Sendable {
    public var directory: String
    public var target: String?
    public var effectiveTarget: String?
    public var status: CanvasShowStatus
    public var url: String?
    public init(directory: String, target: String?, effectiveTarget: String?, status: CanvasShowStatus, url: String?) {
        self.directory = directory; self.target = target; self.effectiveTarget = effectiveTarget
        self.status = status; self.url = url
    }
}

public enum CanvasA2UICommand: String, Codable, Sendable {
    case pushJSONL
    case reset
}

// MARK: - Request

public enum Request: Sendable {
    case notify(title: String, body: String, sound: String?, priority: NotificationPriority?, delivery: NotificationDelivery?)
    case ensurePermissions([Capability], interactive: Bool)
    case runShell(command: [String], cwd: String?, env: [String: String]?, timeoutSec: Double?, needsScreenRecording: Bool)
    case status
    case agent(message: String, thinking: String?, session: String?, deliver: Bool, to: String?)
    case rpcStatus
    case canvasPresent(session: String, path: String?, placement: CanvasPlacement?)
    case canvasHide(session: String)
    case canvasEval(session: String, javaScript: String)
    case canvasSnapshot(session: String, outPath: String?)
    case canvasA2UI(session: String, command: CanvasA2UICommand, jsonl: String?)
    case nodeList
    case nodeDescribe(nodeId: String)
    case nodeInvoke(nodeId: String, command: String, paramsJSON: String?)
    case cameraSnap(facing: CameraFacing?, maxWidth: Int?, quality: Double?, outPath: String?)
    case cameraClip(facing: CameraFacing?, durationMs: Int?, includeAudio: Bool, outPath: String?)
    case screenRecord(screenIndex: Int?, durationMs: Int?, fps: Double?, includeAudio: Bool, outPath: String?)
}

// MARK: - Response

public struct Response: Codable, Sendable {
    public var ok: Bool
    public var message: String?
    public var payload: Data?
    public init(ok: Bool, message: String? = nil, payload: Data? = nil) {
        self.ok = ok; self.message = message; self.payload = payload
    }
}

// MARK: - Request Codable

extension Request: Codable {
    private enum CodingKeys: String, CodingKey {
        case type, title, body, sound, priority, delivery, caps, interactive
        case command, cwd, env, timeoutSec, needsScreenRecording
        case message, thinking, session, deliver, to, path, javaScript, outPath
        case screenIndex, fps, canvasA2UICommand, jsonl, facing, maxWidth, quality
        case durationMs, includeAudio, placement, nodeId, nodeCommand, paramsJSON
    }

    private enum Kind: String, Codable {
        case notify, ensurePermissions, runShell, status, agent, rpcStatus
        case canvasPresent, canvasHide, canvasEval, canvasSnapshot, canvasA2UI
        case nodeList, nodeDescribe, nodeInvoke, cameraSnap, cameraClip, screenRecord
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .notify(title, body, sound, priority, delivery):
            try c.encode(Kind.notify, forKey: .type); try c.encode(title, forKey: .title)
            try c.encode(body, forKey: .body); try c.encodeIfPresent(sound, forKey: .sound)
            try c.encodeIfPresent(priority, forKey: .priority); try c.encodeIfPresent(delivery, forKey: .delivery)
        case let .ensurePermissions(caps, interactive):
            try c.encode(Kind.ensurePermissions, forKey: .type)
            try c.encode(caps, forKey: .caps); try c.encode(interactive, forKey: .interactive)
        case let .runShell(cmd, cwd, env, timeout, sr):
            try c.encode(Kind.runShell, forKey: .type); try c.encode(cmd, forKey: .command)
            try c.encodeIfPresent(cwd, forKey: .cwd); try c.encodeIfPresent(env, forKey: .env)
            try c.encodeIfPresent(timeout, forKey: .timeoutSec); try c.encode(sr, forKey: .needsScreenRecording)
        case .status: try c.encode(Kind.status, forKey: .type)
        case let .agent(msg, thinking, session, deliver, to):
            try c.encode(Kind.agent, forKey: .type); try c.encode(msg, forKey: .message)
            try c.encodeIfPresent(thinking, forKey: .thinking); try c.encodeIfPresent(session, forKey: .session)
            try c.encode(deliver, forKey: .deliver); try c.encodeIfPresent(to, forKey: .to)
        case .rpcStatus: try c.encode(Kind.rpcStatus, forKey: .type)
        case let .canvasPresent(s, p, pl):
            try c.encode(Kind.canvasPresent, forKey: .type); try c.encode(s, forKey: .session)
            try c.encodeIfPresent(p, forKey: .path); try c.encodeIfPresent(pl, forKey: .placement)
        case let .canvasHide(s):
            try c.encode(Kind.canvasHide, forKey: .type); try c.encode(s, forKey: .session)
        case let .canvasEval(s, js):
            try c.encode(Kind.canvasEval, forKey: .type); try c.encode(s, forKey: .session)
            try c.encode(js, forKey: .javaScript)
        case let .canvasSnapshot(s, o):
            try c.encode(Kind.canvasSnapshot, forKey: .type); try c.encode(s, forKey: .session)
            try c.encodeIfPresent(o, forKey: .outPath)
        case let .canvasA2UI(s, cmd, jsonl):
            try c.encode(Kind.canvasA2UI, forKey: .type); try c.encode(s, forKey: .session)
            try c.encode(cmd, forKey: .canvasA2UICommand); try c.encodeIfPresent(jsonl, forKey: .jsonl)
        case .nodeList: try c.encode(Kind.nodeList, forKey: .type)
        case let .nodeDescribe(id):
            try c.encode(Kind.nodeDescribe, forKey: .type); try c.encode(id, forKey: .nodeId)
        case let .nodeInvoke(id, cmd, params):
            try c.encode(Kind.nodeInvoke, forKey: .type); try c.encode(id, forKey: .nodeId)
            try c.encode(cmd, forKey: .nodeCommand); try c.encodeIfPresent(params, forKey: .paramsJSON)
        case let .cameraSnap(f, w, q, o):
            try c.encode(Kind.cameraSnap, forKey: .type); try c.encodeIfPresent(f, forKey: .facing)
            try c.encodeIfPresent(w, forKey: .maxWidth); try c.encodeIfPresent(q, forKey: .quality)
            try c.encodeIfPresent(o, forKey: .outPath)
        case let .cameraClip(f, d, a, o):
            try c.encode(Kind.cameraClip, forKey: .type); try c.encodeIfPresent(f, forKey: .facing)
            try c.encodeIfPresent(d, forKey: .durationMs); try c.encode(a, forKey: .includeAudio)
            try c.encodeIfPresent(o, forKey: .outPath)
        case let .screenRecord(si, d, fps, a, o):
            try c.encode(Kind.screenRecord, forKey: .type); try c.encodeIfPresent(si, forKey: .screenIndex)
            try c.encodeIfPresent(d, forKey: .durationMs); try c.encodeIfPresent(fps, forKey: .fps)
            try c.encode(a, forKey: .includeAudio); try c.encodeIfPresent(o, forKey: .outPath)
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decode(Kind.self, forKey: .type) {
        case .notify:
            self = .notify(title: try c.decode(String.self, forKey: .title),
                body: try c.decode(String.self, forKey: .body),
                sound: try c.decodeIfPresent(String.self, forKey: .sound),
                priority: try c.decodeIfPresent(NotificationPriority.self, forKey: .priority),
                delivery: try c.decodeIfPresent(NotificationDelivery.self, forKey: .delivery))
        case .ensurePermissions:
            self = .ensurePermissions(try c.decode([Capability].self, forKey: .caps), interactive: try c.decode(Bool.self, forKey: .interactive))
        case .runShell:
            self = .runShell(command: try c.decode([String].self, forKey: .command),
                cwd: try c.decodeIfPresent(String.self, forKey: .cwd),
                env: try c.decodeIfPresent([String: String].self, forKey: .env),
                timeoutSec: try c.decodeIfPresent(Double.self, forKey: .timeoutSec),
                needsScreenRecording: try c.decode(Bool.self, forKey: .needsScreenRecording))
        case .status: self = .status
        case .agent:
            self = .agent(message: try c.decode(String.self, forKey: .message),
                thinking: try c.decodeIfPresent(String.self, forKey: .thinking),
                session: try c.decodeIfPresent(String.self, forKey: .session),
                deliver: try c.decode(Bool.self, forKey: .deliver),
                to: try c.decodeIfPresent(String.self, forKey: .to))
        case .rpcStatus: self = .rpcStatus
        case .canvasPresent:
            self = .canvasPresent(session: try c.decode(String.self, forKey: .session),
                path: try c.decodeIfPresent(String.self, forKey: .path),
                placement: try c.decodeIfPresent(CanvasPlacement.self, forKey: .placement))
        case .canvasHide: self = .canvasHide(session: try c.decode(String.self, forKey: .session))
        case .canvasEval:
            self = .canvasEval(session: try c.decode(String.self, forKey: .session),
                javaScript: try c.decode(String.self, forKey: .javaScript))
        case .canvasSnapshot:
            self = .canvasSnapshot(session: try c.decode(String.self, forKey: .session),
                outPath: try c.decodeIfPresent(String.self, forKey: .outPath))
        case .canvasA2UI:
            self = .canvasA2UI(session: try c.decode(String.self, forKey: .session),
                command: try c.decode(CanvasA2UICommand.self, forKey: .canvasA2UICommand),
                jsonl: try c.decodeIfPresent(String.self, forKey: .jsonl))
        case .nodeList: self = .nodeList
        case .nodeDescribe: self = .nodeDescribe(nodeId: try c.decode(String.self, forKey: .nodeId))
        case .nodeInvoke:
            self = .nodeInvoke(nodeId: try c.decode(String.self, forKey: .nodeId),
                command: try c.decode(String.self, forKey: .nodeCommand),
                paramsJSON: try c.decodeIfPresent(String.self, forKey: .paramsJSON))
        case .cameraSnap:
            self = .cameraSnap(facing: try c.decodeIfPresent(CameraFacing.self, forKey: .facing),
                maxWidth: try c.decodeIfPresent(Int.self, forKey: .maxWidth),
                quality: try c.decodeIfPresent(Double.self, forKey: .quality),
                outPath: try c.decodeIfPresent(String.self, forKey: .outPath))
        case .cameraClip:
            self = .cameraClip(facing: try c.decodeIfPresent(CameraFacing.self, forKey: .facing),
                durationMs: try c.decodeIfPresent(Int.self, forKey: .durationMs),
                includeAudio: (try? c.decode(Bool.self, forKey: .includeAudio)) ?? true,
                outPath: try c.decodeIfPresent(String.self, forKey: .outPath))
        case .screenRecord:
            self = .screenRecord(screenIndex: try c.decodeIfPresent(Int.self, forKey: .screenIndex),
                durationMs: try c.decodeIfPresent(Int.self, forKey: .durationMs),
                fps: try c.decodeIfPresent(Double.self, forKey: .fps),
                includeAudio: (try? c.decode(Bool.self, forKey: .includeAudio)) ?? true,
                outPath: try c.decodeIfPresent(String.self, forKey: .outPath))
        }
    }
}

/// Control socket path for IPC communication.
public let controlSocketPath: String = {
    let home = FileManager().homeDirectoryForCurrentUser
    return home.appendingPathComponent("Library/Application Support/CoreBlow/control.sock").path
}()
