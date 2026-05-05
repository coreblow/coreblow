import Foundation
enum TerminationSignalWatcher { static func install(onTerminate: @escaping @Sendable () -> Void) { signal(SIGTERM) { _ in onTerminate() }; signal(SIGINT) { _ in onTerminate() } } }
