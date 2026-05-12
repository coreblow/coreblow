import Foundation

/// CoreBlow: Original implementation of Device Diagnostic schema structures.
/// 1. Pattern borrowed: Creating strongly-typed representations of system status (Battery, Thermal, Network, Storage).
/// 2. Implemented differently: Grouped entirely under a unified `CoreBlowDeviceDiagnostics` namespace to avoid polluting the global scope.
/// Used Swift-native `Measurement<UnitInformationStorage>` style representations conceptually via well-named byte counters,
/// and improved enumeration semantic naming (e.g., `active` vs `satisfied`).

public enum CoreBlowDeviceDiagnostics {

    // MARK: - Core Commands

    public enum CommandAction: String, Codable, Sendable {
        case retrieveStatus = "device.status"
        case retrieveSystemInfo = "device.info"
    }

    // MARK: - Battery & Power

    public enum PowerState: String, Codable, Sendable {
        case undetermined
        case discharging
        case charging
        case fullyCharged
    }

    public struct BatteryReport: Codable, Sendable, Equatable {
        public let chargePercentage: Double?
        public let currentPowerState: PowerState
        public let isEnergySaverActive: Bool

        public init(chargePercentage: Double?, currentPowerState: PowerState, isEnergySaverActive: Bool) {
            self.chargePercentage = chargePercentage
            self.currentPowerState = currentPowerState
            self.isEnergySaverActive = isEnergySaverActive
        }
    }

    // MARK: - Hardware Thermals

    public enum ThermalCondition: String, Codable, Sendable {
        case optimal
        case elevated
        case high
        case emergency
    }

    public struct ThermalReport: Codable, Sendable, Equatable {
        public let condition: ThermalCondition

        public init(condition: ThermalCondition) {
            self.condition = condition
        }
    }

    // MARK: - Disk Storage

    public struct StorageReport: Codable, Sendable, Equatable {
        public let capacityBytes: Int64
        public let availableBytes: Int64
        public let consumedBytes: Int64

        public init(capacityBytes: Int64, availableBytes: Int64, consumedBytes: Int64) {
            self.capacityBytes = capacityBytes
            self.availableBytes = availableBytes
            self.consumedBytes = consumedBytes
        }
    }

    // MARK: - Networking

    public enum NetworkLinkStatus: String, Codable, Sendable {
        case active
        case disconnected
        case pendingConnection
    }

    public enum InterfaceMedium: String, Codable, Sendable {
        case wireless
        case mobileBroadband
        case ethernet
        case loopbackOrOther
    }

    public struct NetworkReport: Codable, Sendable, Equatable {
        public let linkStatus: NetworkLinkStatus
        public let usesMeteredConnection: Bool
        public let isDataConstrained: Bool
        public let activeMediums: [InterfaceMedium]

        public init(
            linkStatus: NetworkLinkStatus,
            usesMeteredConnection: Bool,
            isDataConstrained: Bool,
            activeMediums: [InterfaceMedium]
        ) {
            self.linkStatus = linkStatus
            self.usesMeteredConnection = usesMeteredConnection
            self.isDataConstrained = isDataConstrained
            self.activeMediums = activeMediums
        }
    }

    // MARK: - Aggregate Payloads

    public struct SystemStatusPayload: Codable, Sendable, Equatable {
        public let power: BatteryReport
        public let thermals: ThermalReport
        public let disk: StorageReport
        public let networking: NetworkReport
        public let continuousUptimeSeconds: Double

        public init(
            power: BatteryReport,
            thermals: ThermalReport,
            disk: StorageReport,
            networking: NetworkReport,
            continuousUptimeSeconds: Double
        ) {
            self.power = power
            self.thermals = thermals
            self.disk = disk
            self.networking = networking
            self.continuousUptimeSeconds = continuousUptimeSeconds
        }
    }

    public struct IdentityInfoPayload: Codable, Sendable, Equatable {
        public let hostName: String
        public let hardwareIdentifier: String
        public let osName: String
        public let osVersion: String
        public let clientVersion: String
        public let clientBuildNumber: String
        public let activeLocale: String

        public init(
            hostName: String,
            hardwareIdentifier: String,
            osName: String,
            osVersion: String,
            clientVersion: String,
            clientBuildNumber: String,
            activeLocale: String
        ) {
            self.hostName = hostName
            self.hardwareIdentifier = hardwareIdentifier
            self.osName = osName
            self.osVersion = osVersion
            self.clientVersion = clientVersion
            self.clientBuildNumber = clientBuildNumber
            self.activeLocale = activeLocale
        }
    }
}
