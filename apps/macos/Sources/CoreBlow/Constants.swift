import Foundation
import CoreBlowKit
import OSLog
import CoreBlowKit

let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26

let pauseDefaultsKey = "CoreBlow_isPaused"
let onboardingSeenKey = "CoreBlow_onboardingSeen"
let canvasEnabledKey = "CoreBlow_canvasEnabled"
let voiceWakeEnabledKey = "CoreBlow_voiceWakeEnabled"
let voiceWakeTriggerWordsKey = "CoreBlow_voiceWakeTriggerWords"
let voiceWakeTriggerChimeKey = "CoreBlow_voiceWakeTriggerChime"
let voiceWakeMicIDKey = "CoreBlow_voiceWakeMicID"
let voiceWakeMicNameKey = "CoreBlow_voiceWakeMicName"
let voiceWakeLocaleIDKey = "CoreBlow_voiceWakeLocaleID"
let heartbeatsEnabledKey = "CoreBlow_heartbeatsEnabled"
let debugPaneEnabledKey = "CoreBlow_debugPaneEnabled"
let showDockIconKey = "CoreBlow_showDockIcon"
let iconAnimationsKey = "CoreBlow_iconAnimationsEnabled"
let seamColorKey = "CoreBlow_seamColorHex"
let canvasPanelVisibleKey = "CoreBlow_canvasPanelVisible"
let voicePushToTalkKey = "CoreBlow_voicePushToTalkEnabled"
let execApprovalModeKey = "CoreBlow_execApprovalMode"
let talkEnabledKey = "CoreBlow_talkEnabled"

let defaultVoiceWakeTriggers: [String] = ["hey coreblow", "ok coreblow"]


// sanitizeVoiceWakeTriggers and normalizeLocaleIdentifier are defined in VoiceWakeHelpers.swift


enum Constants {
    static let appName = "CoreBlow"
    static let bundleIdentifier = "ai.coreblow.mac"
    static let gatewayServiceType = "_coreblow._tcp"
    static let defaultGatewayPort: UInt16 = 3000
    static let protocolVersion = 3
    static let heartbeatInterval: TimeInterval = 30
    static let reconnectDelay: TimeInterval = 5
    static let maxReconnectAttempts = 10
    static let controlSocketName = "control.sock"
}
