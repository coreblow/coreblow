import AppKit
enum SystemPresenceInfo { static var isScreenLocked: Bool { false }; static var isScreenSaverRunning: Bool { false }; static var idleTime: TimeInterval { CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .mouseMoved) } }
