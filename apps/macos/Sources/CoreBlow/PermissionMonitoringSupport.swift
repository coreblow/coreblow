import Foundation
enum PermissionMonitoringSupport {
    static func monitorChanges(for capabilities: [Capability], interval: TimeInterval = 5, onChange: @escaping @Sendable (Capability, Bool) -> Void) -> Task<Void, Never> {
        Task { var lastStates: [Capability: Bool] = [:]; while !Task.isCancelled { for cap in capabilities { let granted = await PermissionManager().check(cap); if lastStates[cap] != granted { onChange(cap, granted); lastStates[cap] = granted } }; try? await Task.sleep(for: .seconds(interval)) } }
    }
}
