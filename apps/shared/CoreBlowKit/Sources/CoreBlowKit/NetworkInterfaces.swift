// CoreBlowKit/Gateway/NetworkInterfaces.swift
// Local network interface enumeration for gateway discovery.

import Foundation

#if canImport(Darwin)
import Darwin
#endif

/// Represents a local network interface with its IPv4 address.
public struct NetworkInterface: Sendable, Hashable {
    public let name: String
    public let address: String
    public let isLoopback: Bool

    public init(name: String, address: String, isLoopback: Bool = false) {
        self.name = name; self.address = address; self.isLoopback = isLoopback
    }
}

/// Enumerates local network interfaces.
public enum NetworkInterfaces {
    /// Get all IPv4 interfaces on this device.
    public static func allIPv4() -> [NetworkInterface] {
        var result: [NetworkInterface] = []

        #if canImport(Darwin)
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return result }
        defer { freeifaddrs(ifaddr) }

        var current: UnsafeMutablePointer<ifaddrs>? = first
        while let ifa = current {
            if let sa = ifa.pointee.ifa_addr, sa.pointee.sa_family == UInt8(AF_INET) {
                let name = String(cString: ifa.pointee.ifa_name)
                var addr = sa.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee }
                var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                inet_ntop(AF_INET, &addr.sin_addr, &buffer, socklen_t(INET_ADDRSTRLEN))
                let address = String(cString: buffer)
                let isLoopback = (ifa.pointee.ifa_flags & UInt32(IFF_LOOPBACK)) != 0
                result.append(NetworkInterface(name: name, address: address, isLoopback: isLoopback))
            }
            current = ifa.pointee.ifa_next
        }
        #endif

        return result
    }

    /// Get the primary non-loopback IPv4 address.
    public static func primaryIPv4() -> String? {
        allIPv4()
            .filter { !$0.isLoopback && !$0.address.hasPrefix("169.254") }
            .first?.address
    }

    /// Get the loopback address (always 127.0.0.1 on Darwin).
    public static func loopback() -> String {
        "127.0.0.1"
    }
}
