import Foundation
import CoreBlowKit
import OSLog
import CoreBlowKit

/// Watches a config file for changes using DispatchSource with hash-based dedup and polling fallback.
actor ConfigFileWatcher {
    private let url: URL
    private let logger = Logger(subsystem: "ai.coreblow", category: "config-watcher")
    let onChange: @Sendable () -> Void
    private var source: DispatchSourceFileSystemObject?
    private var fileDescriptor: Int32 = -1
    private var lastKnownHash: String?
    private var pollingTask: Task<Void, Never>?

    init(url: URL, onChange: @escaping @Sendable () -> Void) {
        self.url = url
        self.onChange = onChange
    }

    func start() {
        stop()
        lastKnownHash = currentHash()

        let path = url.path
        let fd = open(path, O_EVTONLY)

        guard fd >= 0 else {
            logger.warning("ConfigFileWatcher: cannot open \(path, privacy: .public) — starting poll fallback")
            startPolling()
            return
        }

        fileDescriptor = fd
        let src = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write, .rename, .delete, .attrib],
            queue: DispatchQueue.global(qos: .utility))

        src.setEventHandler { [weak self] in
            guard let self else { return }
            Task { await self.handleFileEvent() }
        }

        src.setCancelHandler { [weak self] in
            guard let self else { return }
            Task { await self.closeDescriptor() }
        }

        source = src
        src.resume()
        logger.info("ConfigFileWatcher: watching \(path, privacy: .public)")
    }

    func stop() {
        pollingTask?.cancel()
        pollingTask = nil
        source?.cancel()
        source = nil
    }

    // MARK: - Event Handling

    private func handleFileEvent() {
        let newHash = currentHash()
        guard newHash != lastKnownHash else { return }
        lastKnownHash = newHash
        logger.debug("ConfigFileWatcher: file changed")
        onChange()

        // If deleted/renamed, restart to pick up recreated file
        if !FileManager.default.fileExists(atPath: url.path) {
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                await self.start()
            }
        }
    }

    private func closeDescriptor() {
        if fileDescriptor >= 0 {
            close(fileDescriptor)
            fileDescriptor = -1
        }
    }

    // MARK: - Polling Fallback

    private func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000) // 5s
                guard let self else { return }
                if FileManager.default.fileExists(atPath: await self.url.path) {
                    await self.start()
                    return
                }
            }
        }
    }

    // MARK: - Hash

    private func currentHash() -> String? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
        let size = (attrs?[.size] as? Int) ?? 0
        let modDate = (attrs?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        return "\(size):\(modDate)"
    }
}
