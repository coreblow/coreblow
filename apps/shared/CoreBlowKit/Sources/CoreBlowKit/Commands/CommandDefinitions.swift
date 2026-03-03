// CoreBlowKit/Commands/CommandDefinitions.swift
// Command type definitions for device capabilities.

import Foundation
import CoreBlowProtocol

// MARK: - Command Namespace

/// CoreBlow command namespaces for device capabilities.
public enum CommandNamespace: String, Sendable {
    case device
    case camera
    case screen
    case location
    case browser
    case contacts
    case calendar
    case reminders
    case photos
    case system
    case talk
    case canvas
    case chat
    case watch
    case motion
}

// MARK: - Device Commands

/// Standard device commands.
public enum DeviceCommand: String, Sendable {
    case vibrate = "device.vibrate"
    case flashlight = "device.flashlight"
    case clipboard = "device.clipboard"
    case copyToClipboard = "device.copy-to-clipboard"
    case openUrl = "device.open-url"
    case batteryLevel = "device.battery-level"
    case deviceInfo = "device.device-info"
    case notification = "device.notification"
    case screenshot = "device.screenshot"
}

// MARK: - Camera Commands

/// Camera interaction commands.
public enum CameraCommand: String, Sendable {
    case capture = "camera.capture"
    case startStream = "camera.start-stream"
    case stopStream = "camera.stop-stream"
    case switchLens = "camera.switch-lens"
    case setResolution = "camera.set-resolution"
}

// MARK: - Screen Commands

/// Screen capture commands.
public enum ScreenCommand: String, Sendable {
    case capture = "screen.capture"
    case startStream = "screen.start-stream"
    case stopStream = "screen.stop-stream"
}

// MARK: - Location Commands

/// Location service commands.
public enum LocationCommand: String, Sendable {
    case current = "location.current"
    case subscribe = "location.subscribe"
    case unsubscribe = "location.unsubscribe"
    case geocode = "location.geocode"
    case reverseGeocode = "location.reverse-geocode"
}

// MARK: - Browser Commands

/// Browser interaction commands.
public enum BrowserCommand: String, Sendable {
    case open = "browser.open"
    case search = "browser.search"
    case readPage = "browser.read-page"
}

// MARK: - System Commands

/// System-level commands.
public enum SystemCommand: String, Sendable {
    case exec = "system.exec"
    case fileRead = "system.file-read"
    case fileWrite = "system.file-write"
    case fileLs = "system.file-ls"
    case fileSearch = "system.file-search"
    case processLs = "system.process-ls"
    case memoryUsage = "system.memory-usage"
}

// MARK: - Canvas Commands

/// Canvas/A2UI commands.
public enum CanvasCommand: String, Sendable {
    case open = "canvas.open"
    case close = "canvas.close"
    case update = "canvas.update"
    case action = "canvas.action"
}

// MARK: - Talk Commands

/// Voice/TTS commands.
public enum TalkCommand: String, Sendable {
    case speak = "talk.speak"
    case stop = "talk.stop"
    case setVoice = "talk.set-voice"
    case listVoices = "talk.list-voices"
}

// MARK: - Chat Commands

/// Chat interaction commands.
public enum ChatCommand: String, Sendable {
    case send = "chat.send"
    case typing = "chat.typing"
    case read = "chat.read"
}

// MARK: - Capabilities

/// Device capability flags reported during connect.
public enum DeviceCapability: String, Sendable {
    case camera
    case microphone
    case location
    case notifications
    case clipboard
    case screen
    case filesystem
    case browser
    case contacts
    case calendar
    case reminders
    case photos
    case bluetooth
    case nfc
    case biometrics
    case accelerometer
    case gyroscope
    case talk
    case canvas
}
