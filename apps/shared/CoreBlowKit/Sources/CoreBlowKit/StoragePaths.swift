// CoreBlowKit/Identity/StoragePaths.swift
// Filesystem paths for CoreBlow app data, canvas, and caches.

import Foundation

/// Standard filesystem paths for CoreBlow data storage.
public enum CoreBlowStorage {
    /// Application Support directory for persistent data.
    public static func appSupportDir() throws -> URL {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw NSError(domain: "CoreBlowStorage", code: 1,
                         userInfo: [NSLocalizedDescriptionKey: "Application Support directory unavailable"])
        }
        return base.appendingPathComponent("CoreBlow", isDirectory: true)
    }

    /// Canvas data root for a session.
    public static func canvasRoot(sessionKey: String) throws -> URL {
        let root = try appSupportDir().appendingPathComponent("canvas", isDirectory: true)
        let safe = sessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
        return root.appendingPathComponent(safe.isEmpty ? "main" : safe, isDirectory: true)
    }

    /// Caches directory for temporary data.
    public static func cachesDir() throws -> URL {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            throw NSError(domain: "CoreBlowStorage", code: 2,
                         userInfo: [NSLocalizedDescriptionKey: "Caches directory unavailable"])
        }
        return base.appendingPathComponent("CoreBlow", isDirectory: true)
    }

    /// Canvas snapshots directory for a session.
    public static func canvasSnapshotsRoot(sessionKey: String) throws -> URL {
        let root = try cachesDir().appendingPathComponent("canvas-snapshots", isDirectory: true)
        let safe = sessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
        return root.appendingPathComponent(safe.isEmpty ? "main" : safe, isDirectory: true)
    }

    /// Ensure a directory exists, creating it if needed.
    @discardableResult
    public static func ensureDirectory(at url: URL) throws -> URL {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}
