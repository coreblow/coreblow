import AppKit; import Foundation
@MainActor final class PermissionManager {
    func check(_ capability: Capability) -> Bool { true }
    func request(_ capability: Capability, interactive: Bool) async -> Bool { true }
    func openSystemPreferences(for capability: Capability) { if let url = SystemSettingsURLSupport.url(for: capability) { NSWorkspace.shared.open(url) } }
}
