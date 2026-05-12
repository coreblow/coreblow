import Foundation
import OSLog
import CoreBlowKit
import OSLog

protocol SimpleFileWatcherOwner: AnyObject {
    var watcher: SimpleFileWatcher { get }
}

extension SimpleFileWatcherOwner {
    func start() {
        self.watcher.start()
    }

    func stop() {
        self.watcher.stop()
    }
}
