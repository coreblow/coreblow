import Foundation
public enum PlatformCapability: String, CaseIterable, Sendable {
    case exec, camera, microphone, screen, location, contacts, calendar, reminders, photos, notifications, accessibility, speechRecognition, browser
}
public struct CapabilityReport: Codable, Sendable { public var available: [String]; public var denied: [String] }
