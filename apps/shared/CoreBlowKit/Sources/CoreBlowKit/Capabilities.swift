// CoreBlowKit/Commands/Capabilities.swift
// Runtime capability negotiation and permission tracking.

import Foundation

/// Runtime device capabilities with permission state tracking.
public struct DeviceCapabilities: Sendable, Codable {
    public var camera: PermissionState
    public var microphone: PermissionState
    public var location: PermissionState
    public var notifications: PermissionState
    public var contacts: PermissionState
    public var calendar: PermissionState
    public var reminders: PermissionState
    public var photos: PermissionState
    public var clipboard: PermissionState
    public var screen: PermissionState
    public var filesystem: PermissionState
    public var bluetooth: PermissionState

    /// Permission state for a capability.
    public enum PermissionState: String, Sendable, Codable {
        case notDetermined = "not_determined"
        case authorized
        case denied
        case restricted
        case unavailable
    }

    /// Default capabilities (all not determined).
    public init(
        camera: PermissionState = .notDetermined, microphone: PermissionState = .notDetermined,
        location: PermissionState = .notDetermined, notifications: PermissionState = .notDetermined,
        contacts: PermissionState = .notDetermined, calendar: PermissionState = .notDetermined,
        reminders: PermissionState = .notDetermined, photos: PermissionState = .notDetermined,
        clipboard: PermissionState = .authorized, screen: PermissionState = .notDetermined,
        filesystem: PermissionState = .authorized, bluetooth: PermissionState = .notDetermined
    ) {
        self.camera = camera; self.microphone = microphone
        self.location = location; self.notifications = notifications
        self.contacts = contacts; self.calendar = calendar
        self.reminders = reminders; self.photos = photos
        self.clipboard = clipboard; self.screen = screen
        self.filesystem = filesystem; self.bluetooth = bluetooth
    }

    /// List of authorized capability names.
    public var authorizedCapabilities: [String] {
        var caps: [String] = []
        let mirror = Mirror(reflecting: self)
        for child in mirror.children {
            if let label = child.label, let state = child.value as? PermissionState, state == .authorized {
                caps.append(label)
            }
        }
        return caps
    }

    /// Build the permissions dictionary for gateway connect.
    public var permissionsDictionary: [String: Bool] {
        [
            "camera": camera == .authorized,
            "microphone": microphone == .authorized,
            "location": location == .authorized,
            "notifications": notifications == .authorized,
            "contacts": contacts == .authorized,
            "calendar": calendar == .authorized,
            "reminders": reminders == .authorized,
            "photos": photos == .authorized,
            "clipboard": clipboard == .authorized,
            "screen": screen == .authorized,
            "filesystem": filesystem == .authorized,
            "bluetooth": bluetooth == .authorized,
        ]
    }
}
