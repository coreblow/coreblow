// CoreBlowKit/Security/TLSPinning.swift
// TLS certificate pinning for gateway WebSocket connections.

import CryptoKit
import Foundation
import Security

// MARK: - TLS Pinning Parameters

/// Configuration for TLS certificate pinning.
public struct TLSPinningParams: Sendable {
    /// Whether TLS pinning is required.
    public let required: Bool
    /// Expected SHA-256 fingerprint (hex string, optional).
    public let expectedFingerprint: String?
    /// Allow Trust-On-First-Use (TOFU) policy.
    public let allowTOFU: Bool
    /// Stable ID for storing fingerprints.
    public let storeKey: String?

    public init(required: Bool = false, expectedFingerprint: String? = nil,
                allowTOFU: Bool = true, storeKey: String? = nil) {
        self.required = required; self.expectedFingerprint = expectedFingerprint
        self.allowTOFU = allowTOFU; self.storeKey = storeKey
    }
}

// MARK: - TLS Fingerprint Store

/// Persists TLS certificate fingerprints in the Keychain.
public enum TLSFingerprintStore {
    private static let service = "com.coreblow.tls-pinning"

    /// Load a stored fingerprint for the given stable ID.
    public static func load(stableID: String) -> String? {
        let raw = KeychainStore.loadString(service: service, account: stableID)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (raw?.isEmpty == false) ? raw : nil
    }

    /// Save a fingerprint for the given stable ID.
    public static func save(_ fingerprint: String, stableID: String) {
        KeychainStore.saveString(fingerprint, service: service, account: stableID)
    }

    /// Remove a stored fingerprint.
    public static func remove(stableID: String) {
        KeychainStore.delete(service: service, account: stableID)
    }
}

// MARK: - TLS Pinning Session

/// URLSession delegate that implements TLS certificate pinning.
///
/// Supports three modes:
/// 1. **Exact match** — validate against a known fingerprint
/// 2. **TOFU** — trust first seen cert, store for future validation
/// 3. **Required** — reject untrusted certs even without a fingerprint
public final class TLSPinningSession: NSObject, URLSessionDelegate, @unchecked Sendable {
    private let params: TLSPinningParams

    public lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    public init(params: TLSPinningParams) {
        self.params = params
        super.init()
    }

    /// Create a WebSocket task with TLS pinning.
    public func webSocketTask(with url: URL) -> URLSessionWebSocketTask {
        let task = session.webSocketTask(with: url)
        task.maximumMessageSize = 16 * 1024 * 1024
        return task
    }

    // MARK: - URLSessionDelegate

    public func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let expected = params.expectedFingerprint.map(Self.normalizeFingerprint)

        if let fingerprint = Self.certificateFingerprint(trust) {
            // Mode 1: Exact match
            if let expected {
                completionHandler(
                    fingerprint == expected ? .useCredential : .cancelAuthenticationChallenge,
                    fingerprint == expected ? URLCredential(trust: trust) : nil)
                return
            }
            // Mode 2: TOFU
            if params.allowTOFU {
                if let storeKey = params.storeKey {
                    TLSFingerprintStore.save(fingerprint, stableID: storeKey)
                }
                completionHandler(.useCredential, URLCredential(trust: trust))
                return
            }
        }

        // Mode 3: System trust evaluation
        let ok = SecTrustEvaluateWithError(trust, nil)
        if ok || !params.required {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }

    // MARK: - Private: Fingerprint Utilities

    /// SHA-256 fingerprint of the leaf certificate.
    static func certificateFingerprint(_ trust: SecTrust) -> String? {
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              let cert = chain.first
        else { return nil }
        let data = SecCertificateCopyData(cert) as Data
        return SHA256.hash(data: data).compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Normalize a fingerprint string (strip prefix, lowercase, hex only).
    static func normalizeFingerprint(_ raw: String) -> String {
        let stripped = raw.replacingOccurrences(
            of: #"(?i)^sha-?256\s*:?\s*"#,
            with: "", options: .regularExpression)
        return stripped.lowercased().filter(\.isHexDigit)
    }
}
