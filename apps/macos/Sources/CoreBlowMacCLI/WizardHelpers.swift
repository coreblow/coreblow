import Foundation
import CoreBlowProtocol

// MARK: - AnyCodable-based WizardStep for CLI

/// Wire-compatible wizard step using AnyCodable fields for CLI JSON interop.
/// This is separate from the FlexValue-based WizardStep in CoreBlowProtocol.
struct CLIWizardStep: Codable, Sendable {
    let id: String
    let type: ProtoAnyCodable
    let title: String?
    let message: String?
    let options: [[String: ProtoAnyCodable]]?
    let initialvalue: ProtoAnyCodable?
    let placeholder: String?
    let sensitive: Bool?
    let executor: ProtoAnyCodable?

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case title
        case message
        case options
        case initialvalue = "initialValue"
        case placeholder
        case sensitive
        case executor
    }
}

struct CLIWizardOption {
    let value: ProtoAnyCodable?
    let label: String
    let hint: String?
}

// MARK: - Decode / Parse

func decodeWizardStep(_ raw: [String: ProtoAnyCodable]?) -> CLIWizardStep? {
    guard let raw else { return nil }
    guard let data = try? JSONEncoder().encode(raw),
          let step = try? JSONDecoder().decode(CLIWizardStep.self, from: data) else {
        return nil
    }
    return step
}

func parseWizardOptions(_ raw: [[String: ProtoAnyCodable]]?) -> [CLIWizardOption] {
    guard let raw else { return [] }
    return raw.map { entry in
        let value = entry["value"]
        let label = (entry["label"]?.value as? String) ?? ""
        let hint = entry["hint"]?.value as? String
        return CLIWizardOption(value: value, label: label, hint: hint)
    }
}

// MARK: - Step Type / Status Helpers

func wizardStepType(_ step: CLIWizardStep) -> String {
    if let s = step.type.value as? String {
        return s.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }
    if let dict = step.type.value as? [String: Any], let t = dict["type"] as? String {
        return t.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return "unknown"
}

func wizardStatusString(_ status: ProtoAnyCodable?) -> String? {
    guard let status else { return nil }
    if let s = status.value as? String {
        return s.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }
    if let dict = status.value as? [String: Any], let s = dict["status"] as? String {
        return s.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return nil
}

// MARK: - AnyCodable Coercion Helpers

func anyCodableString(_ value: ProtoAnyCodable?) -> String {
    guard let value else { return "" }
    if let s = value.value as? String { return s }
    if let i = value.value as? Int { return String(i) }
    if let d = value.value as? Double { return String(d) }
    if let b = value.value as? Bool { return b ? "true" : "false" }
    return ""
}

func anyCodableBool(_ value: ProtoAnyCodable?) -> Bool {
    guard let value else { return false }
    if let b = value.value as? Bool { return b }
    if let i = value.value as? Int { return i != 0 }
    if let s = value.value as? String {
        let t = s.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        return t == "true" || t == "1" || t == "yes"
    }
    return false
}

func anyCodableArray(_ value: ProtoAnyCodable?) -> [ProtoAnyCodable] {
    guard let value else { return [] }
    if let arr = value.value as? [Any] {
        return arr.map { ProtoAnyCodable($0) }
    }
    return []
}

func anyCodableEqual(_ a: ProtoAnyCodable?, _ b: ProtoAnyCodable?) -> Bool {
    guard let av = a?.value, let bv = b?.value else { return a?.value == nil && b?.value == nil }
    if let la = av as? String, let lb = bv as? String { return la == lb }
    if let la = av as? Int, let lb = bv as? Int { return la == lb }
    if let la = av as? Double, let lb = bv as? Double { return la == lb }
    if let la = av as? Bool, let lb = bv as? Bool { return la == lb }
    return false
}
