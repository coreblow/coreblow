// CoreBlowKit/Identity/InstanceIdentity.swift
// Runtime instance identification — device name, model, platform.

import Foundation

#if canImport(UIKit)
import UIKit
#endif

/// Provides runtime device/instance identification.
///
/// Values are computed once at launch and cached as statics.
public enum InstanceIdentity {
    private static let suiteName = "com.coreblow.shared"
    private static let instanceIdKey = "instanceId"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    /// Persistent instance ID (survives app restarts, unique per install).
    public static let instanceId: String = {
        let store = Self.defaults
        if let existing = store.string(forKey: instanceIdKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !existing.isEmpty
        {
            return existing
        }
        let id = UUID().uuidString.lowercased()
        store.set(id, forKey: instanceIdKey)
        return id
    }()

    /// Human-readable device name.
    public static let displayName: String = {
        #if canImport(UIKit)
        let name = MainActor.assumeIsolated {
            UIDevice.current.name.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return name.isEmpty ? "coreblow" : name
        #else
        if let name = Host.current().localizedName?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !name.isEmpty
        {
            return name
        }
        return "coreblow"
        #endif
    }()

    /// Hardware model identifier (e.g. "Mac16,1", "iPhone16,2").
    public static let modelIdentifier: String? = {
        #if canImport(UIKit)
        var sysInfo = utsname()
        uname(&sysInfo)
        let machine = withUnsafeBytes(of: &sysInfo.machine) { ptr in
            String(bytes: ptr.prefix { $0 != 0 }, encoding: .utf8)
        }
        let trimmed = machine?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
        #else
        var size = 0
        guard sysctlbyname("hw.model", nil, &size, nil, 0) == 0, size > 1 else { return nil }
        var buffer = [CChar](repeating: 0, count: size)
        guard sysctlbyname("hw.model", &buffer, &size, nil, 0) == 0 else { return nil }
        let bytes = buffer.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }
        guard let raw = String(bytes: bytes, encoding: .utf8) else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
        #endif
    }()

    /// Device family string (Mac, iPhone, iPad).
    public static let deviceFamily: String = {
        #if canImport(UIKit)
        return MainActor.assumeIsolated {
            switch UIDevice.current.userInterfaceIdiom {
            case .pad: return "iPad"
            case .phone: return "iPhone"
            default: return "iOS"
            }
        }
        #else
        return "Mac"
        #endif
    }()

    /// Platform string with OS version (e.g. "macOS 15.2.0").
    public static let platformString: String = {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        #if canImport(UIKit)
        let name = MainActor.assumeIsolated {
            switch UIDevice.current.userInterfaceIdiom {
            case .pad: return "iPadOS"
            case .phone: return "iOS"
            default: return "iOS"
            }
        }
        return "\(name) \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
        #else
        return "macOS \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
        #endif
    }()
}
