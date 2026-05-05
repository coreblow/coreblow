import Foundation
enum TestAsyncHelpers { static func wait(_ seconds: TimeInterval) async { try? await Task.sleep(for: .seconds(seconds)) } }
