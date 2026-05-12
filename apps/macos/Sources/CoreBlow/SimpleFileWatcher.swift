import Foundation
import OSLog
import CoreBlowKit
import OSLog

final class SimpleFileWatcher: @unchecked Sendable {
    private let watcher: CoalescingFSEventsWatcher

    init(_ watcher: CoalescingFSEventsWatcher) {
        self.watcher = watcher
    }

    deinit {
        self.stop()
    }

    func start() {
        self.watcher.start()
    }

    func stop() {
        self.watcher.stop()
    }
}
