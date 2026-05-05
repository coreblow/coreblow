import Foundation
final class SimpleFileWatcher { private var source: DispatchSourceFileSystemObject?
    func watch(path: String, onChange: @escaping () -> Void) { let fd = open(path, O_EVTONLY); guard fd >= 0 else { return }; let s = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: [.write], queue: .global()); s.setEventHandler(handler: onChange); s.setCancelHandler { close(fd) }; s.resume(); source = s }
    func stop() { source?.cancel(); source = nil }
}
