// CoreBlowKit/Gateway/AsyncTimeout.swift
// Structured concurrency timeout utility.

import Foundation

/// Async operation timeout using TaskGroup race pattern.
public enum AsyncTimeout {
    /// Run an operation with a timeout. Throws `onTimeout()` if the deadline expires.
    public static func withTimeout<T: Sendable>(
        seconds: Double,
        onTimeout: @escaping @Sendable () -> Error,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        let clamped = max(0, seconds)
        if clamped == 0 { return try await operation() }

        return try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(clamped * 1_000_000_000))
                throw onTimeout()
            }
            guard let result = try await group.next() else { throw onTimeout() }
            group.cancelAll()
            return result
        }
    }

    /// Convenience: timeout specified in milliseconds.
    public static func withTimeoutMs<T: Sendable>(
        ms: Int,
        onTimeout: @escaping @Sendable () -> Error,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withTimeout(
            seconds: Double(max(0, ms)) / 1000.0,
            onTimeout: onTimeout,
            operation: operation)
    }
}
