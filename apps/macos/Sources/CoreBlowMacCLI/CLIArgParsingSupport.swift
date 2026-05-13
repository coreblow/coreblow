import Foundation

enum CLIArgParsingSupport {
    /// Consumes the next positional argument and advances the index.
    /// Returns `nil` (without advancing) if there is no next argument.
    static func nextValue(_ args: [String], index: inout Int) -> String? {
        guard index + 1 < args.count else { return nil }
        index += 1
        return args[index].trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Requires the argument at `index` to exist and be non-empty,
    /// throwing a descriptive `CLIError` for the given flag otherwise.
    static func requireValue(_ args: [String], at index: Int, for flag: String) throws -> String {
        guard index < args.count, !args[index].isEmpty else {
            throw CLIError("missing value for \(flag)")
        }
        return args[index]
    }
}

struct CLIError: Error, CustomStringConvertible {
    let description: String
    init(_ msg: String) { description = msg }
}
