import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Collects battery, thermal, storage, and network status for gateway payloads.
@MainActor
final class DeviceStatusService {

    private let networkStatus: NetworkStatusService

    init(networkStatus: NetworkStatusService = NetworkStatusService()) {
        self.networkStatus = networkStatus
    }

    func status() async throws -> CoreBlowDeviceStatusPayload {
        let battery = batteryStatus()
        let thermal = thermalStatus()
        let storage = storageStatus()
        let network = await networkStatus.currentStatus()
        let uptime = ProcessInfo.processInfo.systemUptime

        return CoreBlowDeviceStatusPayload(
            battery: battery,
            thermal: thermal,
            storage: storage,
            network: network,
            uptimeSeconds: uptime)
    }

    func info() -> CoreBlowDeviceInfoPayload {
        #if canImport(UIKit)
        let device = UIDevice.current
        let deviceName = device.name
        let systemName = device.systemName
        let systemVersion = device.systemVersion
        #else
        let deviceName = Host.current().localizedName ?? "CoreBlow"
        let systemName = "macOS"
        let systemVersion = ProcessInfo.processInfo.operatingSystemVersionString
        #endif

        let locale = Locale.preferredLanguages.first ?? Locale.current.identifier
        return CoreBlowDeviceInfoPayload(
            deviceName: deviceName,
            modelIdentifier: DeviceInfoHelper.modelIdentifier(),
            systemName: systemName,
            systemVersion: systemVersion,
            appVersion: DeviceInfoHelper.appVersion(),
            appBuild: Self.fallbackAppBuild(DeviceInfoHelper.appBuild()),
            locale: locale)
    }

    private func batteryStatus() -> CoreBlowBatteryPayload {
        #if canImport(UIKit)
        let device = UIDevice.current
        device.isBatteryMonitoringEnabled = true
        let level = device.batteryLevel >= 0 ? Double(device.batteryLevel) : nil
        let state: CoreBlowBatteryState = switch device.batteryState {
        case .charging: .charging
        case .full: .full
        case .unplugged: .unplugged
        case .unknown: .unknown
        @unknown default: .unknown
        }
        return CoreBlowBatteryPayload(
            level: level,
            state: state,
            lowPowerModeEnabled: ProcessInfo.processInfo.isLowPowerModeEnabled)
        #else
        return CoreBlowBatteryPayload(level: nil, state: .unknown, lowPowerModeEnabled: false)
        #endif
    }

    private func thermalStatus() -> CoreBlowThermalPayload {
        let state: CoreBlowThermalState = switch ProcessInfo.processInfo.thermalState {
        case .nominal: .nominal
        case .fair: .fair
        case .serious: .serious
        case .critical: .critical
        @unknown default: .nominal
        }
        return CoreBlowThermalPayload(state: state)
    }

    private func storageStatus() -> CoreBlowStoragePayload {
        let attrs = (try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory())) ?? [:]
        let total = (attrs[.systemSize] as? NSNumber)?.int64Value ?? 0
        let free = (attrs[.systemFreeSize] as? NSNumber)?.int64Value ?? 0
        return CoreBlowStoragePayload(totalBytes: total, freeBytes: free, usedBytes: max(0, total - free))
    }

    private static func fallbackAppBuild(_ build: String) -> String {
        build.isEmpty ? "0" : build
    }
}

// MARK: - Payload Types

struct CoreBlowDeviceStatusPayload {
    let battery: CoreBlowBatteryPayload
    let thermal: CoreBlowThermalPayload
    let storage: CoreBlowStoragePayload
    let network: CoreBlowNetworkPayload
    let uptimeSeconds: TimeInterval
}

struct CoreBlowDeviceInfoPayload {
    let deviceName: String
    let modelIdentifier: String
    let systemName: String
    let systemVersion: String
    let appVersion: String
    let appBuild: String
    let locale: String
}

struct CoreBlowBatteryPayload {
    let level: Double?
    let state: CoreBlowBatteryState
    let lowPowerModeEnabled: Bool
}

enum CoreBlowBatteryState { case charging, full, unplugged, unknown }
struct CoreBlowThermalPayload { let state: CoreBlowThermalState }
enum CoreBlowThermalState { case nominal, fair, serious, critical }
struct CoreBlowStoragePayload { let totalBytes: Int64; let freeBytes: Int64; let usedBytes: Int64 }
struct CoreBlowNetworkPayload {
    let status: CoreBlowNetworkPathStatus
    let isExpensive: Bool
    let isConstrained: Bool
    let interfaces: [CoreBlowNetworkInterfaceType]
}
enum CoreBlowNetworkPathStatus { case satisfied, requiresConnection, unsatisfied }
enum CoreBlowNetworkInterfaceType { case wifi, cellular, wired, other }
