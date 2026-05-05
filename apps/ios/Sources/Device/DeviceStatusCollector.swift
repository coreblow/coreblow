import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Collects battery, thermal, and storage telemetry for gateway status payloads.
///
/// Pattern: @MainActor final class (mirrors OC's DeviceStatusService).
@MainActor
final class DeviceStatusCollector {

    /// Battery telemetry snapshot.
    struct BatterySnapshot {
        let level: Double?
        let isCharging: Bool
        let isFull: Bool
        let lowPowerMode: Bool
    }

    /// Thermal state snapshot.
    enum ThermalLevel: String {
        case nominal, fair, serious, critical
    }

    /// Disk usage snapshot.
    struct StorageSnapshot {
        let totalBytes: Int64
        let availableBytes: Int64
        var usedBytes: Int64 { max(0, totalBytes - availableBytes) }
        var usedPercentage: Double {
            guard totalBytes > 0 else { return 0 }
            return Double(usedBytes) / Double(totalBytes) * 100
        }
    }

    /// Full device status report.
    struct StatusReport {
        let battery: BatterySnapshot
        let thermal: ThermalLevel
        let storage: StorageSnapshot
        let uptimeSeconds: TimeInterval
    }

    func collectStatus() -> StatusReport {
        StatusReport(
            battery: readBattery(),
            thermal: readThermal(),
            storage: readStorage(),
            uptimeSeconds: ProcessInfo.processInfo.systemUptime
        )
    }

    func collectDeviceInfo() -> [String: String] {
        var info: [String: String] = [:]
        #if canImport(UIKit)
        let device = UIDevice.current
        info["deviceName"] = device.name
        info["systemName"] = device.systemName
        info["systemVersion"] = device.systemVersion
        #endif
        info["modelIdentifier"] = DeviceInfoProvider.machineIdentifier()
        info["appVersion"] = DeviceInfoProvider.appMarketingVersion()
        info["appBuild"] = DeviceInfoProvider.appBuildNumber().isEmpty ? "0" : DeviceInfoProvider.appBuildNumber()
        info["locale"] = Locale.preferredLanguages.first ?? Locale.current.identifier
        return info
    }

    // MARK: - Private Readers

    private func readBattery() -> BatterySnapshot {
        #if canImport(UIKit)
        let device = UIDevice.current
        device.isBatteryMonitoringEnabled = true
        let raw = device.batteryLevel
        let level: Double? = raw >= 0 ? Double(raw) : nil
        return BatterySnapshot(
            level: level,
            isCharging: device.batteryState == .charging,
            isFull: device.batteryState == .full,
            lowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled
        )
        #else
        return BatterySnapshot(level: nil, isCharging: false, isFull: false, lowPowerMode: false)
        #endif
    }

    private func readThermal() -> ThermalLevel {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return .nominal
        case .fair: return .fair
        case .serious: return .serious
        case .critical: return .critical
        @unknown default: return .nominal
        }
    }

    private func readStorage() -> StorageSnapshot {
        let attrs = (try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())) ?? [:]
        let total = (attrs[.systemSize] as? NSNumber)?.int64Value ?? 0
        let free = (attrs[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
        return StorageSnapshot(totalBytes: total, availableBytes: free)
    }
}
