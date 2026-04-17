// CoreBlowProtocol/FlexValueHelpers.swift
// Utility extensions and helpers for FlexValue manipulation.
//
// CoreBlow replaces the reference implementation's free-standing `anyCodableString()`,
// `anyCodableBool()`, etc. with idiomatic Swift: computed properties
// and extension methods on FlexValue itself.

import Foundation

// MARK: - Coercion Extensions

extension FlexValue {
    /// Coerce any FlexValue to a String representation.
    public var coercedString: String {
        switch self {
        case .string(let s): return s
        case .int(let i): return String(i)
        case .double(let d): return String(d)
        case .bool(let b): return b ? "true" : "false"
        case .null: return ""
        case .array, .object: return description
        }
    }

    /// Coerce any FlexValue to a Bool.
    public var coercedBool: Bool {
        switch self {
        case .bool(let b): return b
        case .int(let i): return i != 0
        case .double(let d): return d != 0
        case .string(let s):
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return t == "true" || t == "1" || t == "yes"
        case .null: return false
        case .array(let a): return !a.isEmpty
        case .object(let d): return !d.isEmpty
        }
    }

    /// Coerce to array of FlexValues (returns empty if not an array).
    public var coercedArray: [FlexValue] {
        arrayValue ?? []
    }

    /// Coerce to a dictionary (returns empty if not an object).
    public var coercedObject: [String: FlexValue] {
        objectValue ?? [:]
    }
}

// MARK: - Wizard / Setup Flow

/// A wizard step in a setup/onboarding flow.
public struct WizardStep: Codable, Sendable {
    public let type: FlexValue
    public let title: String?
    public let description: String?
    public let options: [[String: FlexValue]]?
    public let value: FlexValue?
    public let status: FlexValue?
    public let error: String?

    public init(
        type: FlexValue,
        title: String? = nil,
        description: String? = nil,
        options: [[String: FlexValue]]? = nil,
        value: FlexValue? = nil,
        status: FlexValue? = nil,
        error: String? = nil
    ) {
        self.type = type; self.title = title; self.description = description
        self.options = options; self.value = value; self.status = status
        self.error = error
    }

    /// The step type as a plain string.
    public var typeString: String { type.coercedString }

    /// The status as a lowercase string.
    public var statusString: String? {
        status?.coercedString.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}

/// A selectable option within a wizard step.
public struct WizardOption: Sendable {
    public let value: FlexValue?
    public let label: String
    public let hint: String?

    public init(value: FlexValue?, label: String, hint: String? = nil) {
        self.value = value; self.label = label; self.hint = hint
    }
}

/// Decode a wizard step from a raw FlexValue dictionary.
public func decodeWizardStep(from raw: [String: FlexValue]?) -> WizardStep? {
    guard let raw else { return nil }
    let flex = FlexValue.object(raw)
    guard let data = try? JSONEncoder().encode(flex),
          let step = try? JSONDecoder().decode(WizardStep.self, from: data) else {
        return nil
    }
    return step
}

/// Parse wizard options from a raw array of dictionaries.
public func parseWizardOptions(from raw: [[String: FlexValue]]?) -> [WizardOption] {
    guard let raw else { return [] }
    return raw.map { entry in
        let value = entry["value"]
        let label = entry["label"]?.stringValue ?? ""
        let hint = entry["hint"]?.stringValue
        return WizardOption(value: value, label: label, hint: hint)
    }
}

// MARK: - FlexValue Comparison

extension FlexValue {
    /// Loose equality that coerces across numeric/string boundaries.
    public func looselyEquals(_ other: FlexValue) -> Bool {
        switch (self, other) {
        case (.string(let l), .string(let r)): return l == r
        case (.int(let l), .int(let r)): return l == r
        case (.double(let l), .double(let r)): return l == r
        case (.bool(let l), .bool(let r)): return l == r
        case (.null, .null): return true
        // Cross-type numeric
        case (.int(let l), .double(let r)): return Double(l) == r
        case (.double(let l), .int(let r)): return l == Double(r)
        // Cross-type string/numeric
        case (.string(let l), .int(let r)): return l == String(r)
        case (.int(let l), .string(let r)): return String(l) == r
        case (.string(let l), .double(let r)): return l == String(r)
        case (.double(let l), .string(let r)): return String(l) == r
        default: return false
        }
    }
}

// MARK: - JSON Coding Helpers

extension GatewayFrame {
    /// Decode a frame from raw JSON Data.
    public static func decode(from data: Data) throws -> GatewayFrame {
        try JSONDecoder().decode(GatewayFrame.self, from: data)
    }

    /// Encode this frame to JSON Data.
    public func jsonData() throws -> Data {
        try JSONEncoder().encode(self)
    }
}

extension GatewayRequest {
    /// Encode this request to JSON Data.
    public func jsonData() throws -> Data {
        try JSONEncoder().encode(self)
    }
}
