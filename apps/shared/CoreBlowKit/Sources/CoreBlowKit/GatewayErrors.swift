// CoreBlowKit/Gateway/GatewayErrors.swift
// Typed error hierarchy for gateway connection and RPC failures.

import Foundation
import CoreBlowProtocol

// MARK: - Connect Auth Detail Codes

/// Detailed auth rejection codes from the gateway connect handshake.
public enum GatewayAuthDetailCode: String, Sendable {
    case authRequired = "AUTH_REQUIRED"
    case authUnauthorized = "AUTH_UNAUTHORIZED"
    case authTokenMismatch = "AUTH_TOKEN_MISMATCH"
    case authBootstrapTokenInvalid = "AUTH_BOOTSTRAP_TOKEN_INVALID"
    case authDeviceTokenMismatch = "AUTH_DEVICE_TOKEN_MISMATCH"
    case authTokenMissing = "AUTH_TOKEN_MISSING"
    case authTokenNotConfigured = "AUTH_TOKEN_NOT_CONFIGURED"
    case authPasswordMissing = "AUTH_PASSWORD_MISSING"  // pragma: allowlist secret
    case authPasswordMismatch = "AUTH_PASSWORD_MISMATCH"  // pragma: allowlist secret
    case authPasswordNotConfigured = "AUTH_PASSWORD_NOT_CONFIGURED"  // pragma: allowlist secret
    case authRateLimited = "AUTH_RATE_LIMITED"
    case authTailscaleIdentityMissing = "AUTH_TAILSCALE_IDENTITY_MISSING"
    case authTailscaleProxyMissing = "AUTH_TAILSCALE_PROXY_MISSING"
    case authTailscaleWhoisFailed = "AUTH_TAILSCALE_WHOIS_FAILED"
    case authTailscaleIdentityMismatch = "AUTH_TAILSCALE_IDENTITY_MISMATCH"
    case pairingRequired = "PAIRING_REQUIRED"
    case controlUiDeviceIdentityRequired = "CONTROL_UI_DEVICE_IDENTITY_REQUIRED"
    case deviceIdentityRequired = "DEVICE_IDENTITY_REQUIRED"
    case deviceAuthInvalid = "DEVICE_AUTH_INVALID"
    case deviceAuthDeviceIdMismatch = "DEVICE_AUTH_DEVICE_ID_MISMATCH"
    case deviceAuthSignatureExpired = "DEVICE_AUTH_SIGNATURE_EXPIRED"
    case deviceAuthNonceRequired = "DEVICE_AUTH_NONCE_REQUIRED"
    case deviceAuthNonceMismatch = "DEVICE_AUTH_NONCE_MISMATCH"
    case deviceAuthSignatureInvalid = "DEVICE_AUTH_SIGNATURE_INVALID"
    case deviceAuthPublicKeyInvalid = "DEVICE_AUTH_PUBLIC_KEY_INVALID"

    /// Whether this code represents a non-recoverable auth failure.
    public var isNonRecoverable: Bool {
        switch self {
        case .authTokenMissing, .authBootstrapTokenInvalid,
             .authTokenNotConfigured, .authPasswordMissing,
             .authPasswordMismatch, .authPasswordNotConfigured,
             .authRateLimited, .pairingRequired,
             .controlUiDeviceIdentityRequired, .deviceIdentityRequired:
            return true
        default:
            return false
        }
    }
}

/// Recommended recovery actions after auth failure.
public enum GatewayRecoveryStep: String, Sendable {
    case retryWithDeviceToken = "retry_with_device_token"
    case updateAuthConfiguration = "update_auth_configuration"
    case updateAuthCredentials = "update_auth_credentials"
    case waitThenRetry = "wait_then_retry"
    case reviewAuthConfiguration = "review_auth_configuration"
}

// MARK: - Connect Auth Error

/// Structured error from a failed gateway connect handshake.
public struct GatewayConnectAuthError: LocalizedError, Sendable {
    public let message: String
    public let detailCodeRaw: String?
    public let canRetryWithDeviceToken: Bool
    public let recommendedNextStepRaw: String?

    public init(
        message: String,
        detailCodeRaw: String?,
        canRetryWithDeviceToken: Bool = false,
        recommendedNextStepRaw: String? = nil
    ) {
        let msg = message.trimmingCharacters(in: .whitespacesAndNewlines)
        self.message = msg.isEmpty ? "gateway connect failed" : msg
        self.detailCodeRaw = detailCodeRaw?.nilIfEmpty
        self.canRetryWithDeviceToken = canRetryWithDeviceToken
        self.recommendedNextStepRaw = recommendedNextStepRaw?.nilIfEmpty
    }

    public var detail: GatewayAuthDetailCode? {
        guard let raw = detailCodeRaw else { return nil }
        return GatewayAuthDetailCode(rawValue: raw)
    }

    public var recommendedNextStep: GatewayRecoveryStep? {
        guard let raw = recommendedNextStepRaw else { return nil }
        return GatewayRecoveryStep(rawValue: raw)
    }

    public var isNonRecoverable: Bool { detail?.isNonRecoverable ?? false }
    public var errorDescription: String? { message }
}

// MARK: - RPC Response Error

/// Error from a gateway RPC call that returned `ok: false`.
public struct GatewayRPCError: LocalizedError, Sendable {
    public let method: String
    public let code: String
    public let message: String
    public let details: [String: FlexValue]

    public init(method: String, code: String?, message: String?, details: [String: FlexValue]? = nil) {
        self.method = method
        self.code = code?.nilIfEmpty ?? "GATEWAY_ERROR"
        self.message = message?.nilIfEmpty ?? "gateway error"
        self.details = details ?? [:]
    }

    public var errorDescription: String? {
        code == "GATEWAY_ERROR" ? "\(method): \(message)" : "\(method): [\(code)] \(message)"
    }
}

// MARK: - Decoding Error

/// Error when a gateway response payload can't be decoded.
public struct GatewayDecodingError: LocalizedError, Sendable {
    public let method: String
    public let message: String

    public init(method: String, message: String) {
        self.method = method; self.message = message
    }

    public var errorDescription: String? { "\(method): \(message)" }
}

// MARK: - Timeout Error

/// Error when a gateway operation times out.
public struct GatewayTimeoutError: LocalizedError, Sendable {
    public let context: String
    public init(_ context: String) { self.context = context }
    public var errorDescription: String? { "gateway timeout: \(context)" }
}

// MARK: - Helpers

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
