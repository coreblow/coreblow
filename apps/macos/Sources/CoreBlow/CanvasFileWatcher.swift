import Foundation
actor CanvasFileWatcher {
    private var sources: [String: DispatchSourceFileSystemObject] = []
    func watch(session: String, directory: URL, onChange: @escaping @Sendable () -> Void) {
        let fd = open(directory.path, O_EVTONLY); guard fd >= 0 else { return }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: [.write, .rename], queue: .global())
        source.setEventHandler { onChange() }; source.setCancelHandler { close(fd) }; source.resume(); sources[session] = source
    }
    func unwatch(session: String) { sources[session]?.cancel(); sources.removeValue(forKey: session) }
    func unwatchAll() { sources.values.forEach { $0.cancel() }; sources.removeAll() }
}
