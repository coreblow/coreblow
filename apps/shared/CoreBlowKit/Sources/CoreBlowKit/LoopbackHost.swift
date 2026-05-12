// CoreBlowKit/Gateway/LoopbackHost.swift
// Loopback address detection utility.

import Foundation

/// Utility for detecting loopback/localhost addresses.
public enum LoopbackHost {
    private static let loopbackHosts: Set<String> = [
        "localhost", "127.0.0.1", "::1", "[::1]",
        "0.0.0.0", "ip6-localhost", "ip6-loopback",
    ]

    /// Check if a host string is a loopback address.
    public static func isLoopback(_ host: String) -> Bool {
        let trimmed = host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return loopbackHosts.contains(trimmed) || trimmed.hasPrefix("127.")
    }
}
