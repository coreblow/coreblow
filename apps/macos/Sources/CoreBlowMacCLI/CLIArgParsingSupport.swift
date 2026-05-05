import Foundation

enum CLIArgParsingSupport {
    static func requireValue(_ args: [String], at index: Int, for flag: String) throws -> String {
        guard index < args.count, !args[index].isEmpty else { throw CLIError("missing value for \(flag)") }
        return args[index]
    }
}

struct CLIError: Error, CustomStringConvertible { let description: String; init(_ msg: String) { description = msg } }
