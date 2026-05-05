import Foundation
enum CommandResolver { static func resolve(_ name: String) -> URL? { ExecCommandResolution.resolveExecutable(name) } }
