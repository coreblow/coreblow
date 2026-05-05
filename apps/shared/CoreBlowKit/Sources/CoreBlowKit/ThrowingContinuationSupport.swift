import Foundation
public enum ThrowingContinuationSupport {
    public static func withTimeout<T: Sendable>(_ seconds: TimeInterval, body: @escaping @Sendable (CheckedContinuation<T, Error>) -> Void) async throws -> T {
        try await AsyncTimeout.withTimeout(seconds) { try await withCheckedThrowingContinuation(body) }
    }
}
