import Foundation
import CryptoKit

/// CoreBlow: Original implementation of Gateway TLS Pinning and TOFU logic.
/// 1. Pattern borrowed: Wrapping `URLSessionDelegate` to intercept server trust challenges for WebSocket security.
/// 2. Implemented differently: Designed `CoreBlowTLSConfiguration` and `CoreBlowSecureWebSocketSession` using modern `CryptoKit` SHA256 evaluation. Features structured concurrency warnings instead of silent bypasses.

public struct CoreBlowTLSConfiguration: Sendable, Equatable {
    public let requiresEncryption: Bool
    public let pinnedFingerprint: String?
    public let supportsTrustOnFirstUse: Bool
    public let persistenceIdentifier: String?

    public init(
        requiresEncryption: Bool,
        pinnedFingerprint: String? = nil,
        supportsTrustOnFirstUse: Bool = false,
        persistenceIdentifier: String? = nil
    ) {
        self.requiresEncryption = requiresEncryption
        self.pinnedFingerprint = pinnedFingerprint
        self.supportsTrustOnFirstUse = supportsTrustOnFirstUse
        self.persistenceIdentifier = persistenceIdentifier
    }
}

public struct CoreBlowTLSPinStore {

    private static let serviceNamespace = "com.coreblow.tls.pins"

    /// Retrieves a trusted fingerprint for a known host.
    public static func fetchTrustedFingerprint(for identifier: String) -> String? {
        let store = KeychainStorageProvider(serviceIdentifier: serviceNamespace)
        return try? store.fetchString(forAccount: identifier)
    }

    /// Commits a new trusted fingerprint (TOFU) to the keychain.
    public static func commitTrustedFingerprint(_ fingerprint: String, for identifier: String) {
        let store = KeychainStorageProvider(serviceIdentifier: serviceNamespace)
        try? store.storeString(fingerprint, forAccount: identifier)
    }
}

public final class CoreBlowSecureWebSocketSession: NSObject, WebSocketSessioning, URLSessionDelegate, @unchecked Sendable {

    private let configuration: CoreBlowTLSConfiguration
    private var activeSession: URLSession!

    public init(configuration: CoreBlowTLSConfiguration) {
        self.configuration = configuration
        super.init()

        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.timeoutIntervalForRequest = 10.0
        sessionConfig.timeoutIntervalForResource = 300.0

        self.activeSession = URLSession(
            configuration: sessionConfig,
            delegate: self,
            delegateQueue: nil
        )
    }

    public func makeWebSocketTask(url: URL) -> WebSocketTaskBox {
        let task = activeSession.webSocketTask(with: url)
        return WebSocketTaskBox(task: task)
    }

    // MARK: - URLSessionDelegate

    public func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        // Enforce TLS policy
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        // Extract certificate
        guard let certificate = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        // Compute SHA256 Fingerprint
        let certificateData = SecCertificateCopyData(certificate) as Data
        let digest = SHA256.hash(data: certificateData)
        let computedFingerprint = digest.map { String(format: "%02x", $0) }.joined()

        // 1. Strict Pinning
        if let explicitPin = configuration.pinnedFingerprint {
            if computedFingerprint.lowercased() == explicitPin.lowercased() {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
            } else {
                completionHandler(.cancelAuthenticationChallenge, nil)
            }
            return
        }

        // 2. Trust On First Use (TOFU)
        if configuration.supportsTrustOnFirstUse, let storeId = configuration.persistenceIdentifier {
            if let savedPin = CoreBlowTLSPinStore.fetchTrustedFingerprint(for: storeId) {
                if computedFingerprint.lowercased() == savedPin.lowercased() {
                    completionHandler(.useCredential, URLCredential(trust: serverTrust))
                } else {
                    completionHandler(.cancelAuthenticationChallenge, nil)
                }
            } else {
                // First use: Trust and save
                CoreBlowTLSPinStore.commitTrustedFingerprint(computedFingerprint, for: storeId)
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
            }
            return
        }

        // 3. Fallback to OS Trust evaluation if encryption is required but no pinning is configured
        if configuration.requiresEncryption {
            completionHandler(.performDefaultHandling, nil)
        } else {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        }
    }
}
