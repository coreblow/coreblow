import Foundation
extension ProcessInfo { var isRunningTests: Bool { environment["XCTestConfigurationFilePath"] != nil }; var isPreview: Bool { environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" } }
