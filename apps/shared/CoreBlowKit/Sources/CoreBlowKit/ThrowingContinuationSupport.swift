import Foundation

public enum ThrowingContinuationSupport {
    public static func resumeVoid(_ continuation: CheckedContinuation<Void, Error>, error: Error?) {
        if let error {
            continuation.resume(throwing: error)
        } else {
            continuation.resume()
        }
    }

    public static func withTimeout<T: Sendable>(
        _ seconds: TimeInterval,
        body: @escaping @Sendable (CheckedContinuation<T, Error>) -> Void
    ) async throws -> T {
        try await AsyncTimeout.withTimeout(
            seconds: seconds,
            onTimeout: { NSError(domain: "ThrowingContinuationSupport", code: 1, userInfo: [NSLocalizedDescriptionKey: "Timed out after \(seconds)s"]) },
            operation: { try await withCheckedThrowingContinuation(body) })
    }
}
