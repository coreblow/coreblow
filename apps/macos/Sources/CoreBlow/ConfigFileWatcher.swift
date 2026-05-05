import Foundation
import OSLog
actor ConfigFileWatcher {
    private let url: URL; private var source: DispatchSourceFileSystemObject?
    private let logger = Logger(subsystem: Constants.bundleIdentifier, category: "config-watcher")
    let onChange: @Sendable () -> Void
    init(url: URL, onChange: @escaping @Sendable () -> Void) { self.url = url; self.onChange = onChange }
    func start() {
        let fd = open(url.path, O_EVTONLY); guard fd >= 0 else { logger.warning("Cannot watch \(self.url.path)"); return }
        let src = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: [.write, .rename], queue: .global())
        src.setEventHandler { [onChange] in onChange() }
        src.setCancelHandler { close(fd) }
        src.resume(); source = src
    }
    func stop() { source?.cancel(); source = nil }
}
