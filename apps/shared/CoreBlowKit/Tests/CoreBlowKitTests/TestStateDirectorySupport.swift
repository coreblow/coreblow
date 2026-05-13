import Foundation

private actor CoreBlowStateDirectoryGate {
    private var locked = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        if !self.locked {
            self.locked = true
            return
        }

        await withCheckedContinuation { continuation in
            self.waiters.append(continuation)
        }
    }

    func release() {
        if self.waiters.isEmpty {
            self.locked = false
        } else {
            self.waiters.removeFirst().resume()
        }
    }
}

private let coreBlowStateDirectoryGate = CoreBlowStateDirectoryGate()

func withTemporaryCoreBlowStateDirectory<T>(
    prefix: String = "coreblow-state-test",
    _ body: (URL) async throws -> T
) async throws -> T {
    await coreBlowStateDirectoryGate.acquire()

    let tempDir = FileManager.default.temporaryDirectory
        .appendingPathComponent("\(prefix)-\(UUID().uuidString)", isDirectory: true)
    let previous = getenv("COREBLOW_STATE_DIR").map { String(cString: $0) }

    do {
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        setenv("COREBLOW_STATE_DIR", tempDir.path, 1)
        let result = try await body(tempDir)
        restoreCoreBlowStateDirectory(previous: previous, tempDir: tempDir)
        await coreBlowStateDirectoryGate.release()
        return result
    } catch {
        restoreCoreBlowStateDirectory(previous: previous, tempDir: tempDir)
        await coreBlowStateDirectoryGate.release()
        throw error
    }
}

private func restoreCoreBlowStateDirectory(previous: String?, tempDir: URL) {
    if let previous {
        setenv("COREBLOW_STATE_DIR", previous, 1)
    } else {
        unsetenv("COREBLOW_STATE_DIR")
    }
    try? FileManager.default.removeItem(at: tempDir)
}
