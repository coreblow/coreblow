import Foundation
import CoreBlowKit
import OSLog
import CoreBlowKit

private let resolverLogger = Logger(subsystem: "ai.coreblow", category: "command.resolver")

/// Resolves executable names to their full path via PATH lookup and common locations.
/// Also handles gateway entrypoint resolution, SSH remote commands, and runtime discovery.
enum CommandResolver {
    private static let projectRootDefaultsKey = "coreblow.gatewayProjectRootPath"
    private static let helperName = "coreblow"

    /// Cache of resolved paths for performance.
    private nonisolated(unsafe) static let _cache = NSCache<NSString, NSURL>()
    private nonisolated(unsafe) static var cacheKeys = Set<String>()
    private static let lock = NSLock()

    // MARK: - Gateway Entrypoint

    static func gatewayEntrypoint(in root: URL) -> String? {
        let distEntry = root.appendingPathComponent("dist/index.js").path
        if FileManager().isReadableFile(atPath: distEntry) { return distEntry }
        let coreblowEntry = root.appendingPathComponent("coreblow.mjs").path
        if FileManager().isReadableFile(atPath: coreblowEntry) { return coreblowEntry }
        let binEntry = root.appendingPathComponent("bin/coreblow.js").path
        if FileManager().isReadableFile(atPath: binEntry) { return binEntry }
        return nil
    }

    // MARK: - Runtime Resolution

    static func runtimeResolution() -> Result<RuntimeResolution, RuntimeResolutionError> {
        RuntimeLocator.resolve(searchPaths: preferredPaths())
    }

    static func runtimeResolution(searchPaths: [String]?) -> Result<RuntimeResolution, RuntimeResolutionError> {
        RuntimeLocator.resolve(searchPaths: searchPaths ?? preferredPaths())
    }

    static func makeRuntimeCommand(
        runtime: RuntimeResolution,
        entrypoint: String,
        subcommand: String,
        extraArgs: [String]) -> [String]
    {
        [runtime.path, entrypoint, subcommand] + extraArgs
    }

    static func runtimeErrorCommand(_ error: RuntimeResolutionError) -> [String] {
        let message = RuntimeLocator.describeFailure(error)
        return errorCommand(with: message)
    }

    static func errorCommand(with message: String) -> [String] {
        let script = """
        cat <<'__COREBLOW_ERR__' >&2
        \(message)
        __COREBLOW_ERR__
        exit 1
        """
        return ["/bin/sh", "-c", script]
    }

    // MARK: - Project Root

    static func projectRoot() -> URL {
        if let stored = UserDefaults.standard.string(forKey: projectRootDefaultsKey),
           let url = expandPath(stored),
           FileManager().fileExists(atPath: url.path)
        {
            return url
        }
        let fallback = FileManager().homeDirectoryForCurrentUser
            .appendingPathComponent("Projects/coreblow")
        if FileManager().fileExists(atPath: fallback.path) {
            return fallback
        }
        return FileManager().homeDirectoryForCurrentUser
    }

    static func setProjectRoot(_ path: String) {
        UserDefaults.standard.set(path, forKey: projectRootDefaultsKey)
    }

    static func projectRootPath() -> String {
        projectRoot().path
    }

    // MARK: - Resolve Command

    /// Resolve a command name to its full executable URL.
    static func resolve(_ name: String) -> URL? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let key = trimmed as NSString
        if let cached = _cache.object(forKey: key) {
            return cached as URL
        }

        let result = resolveUncached(trimmed)

        if let result {
            _cache.setObject(result as NSURL, forKey: key)
        }

        return result
    }

    /// Flush the resolver cache (e.g., on PATH change).
    static func clearCache() {
        _cache.removeAllObjects()
    }

    private static func resolveUncached(_ name: String) -> URL? {
        // 1. Absolute path
        if name.hasPrefix("/") || name.hasPrefix("~") {
            let expanded = (name as NSString).expandingTildeInPath
            let url = URL(fileURLWithPath: expanded)
            if FileManager.default.isExecutableFile(atPath: url.path) {
                return url
            }
            return nil
        }

        // 2. PATH lookup
        for dir in preferredPaths() {
            let candidate = URL(fileURLWithPath: dir).appendingPathComponent(name)
            if FileManager.default.isExecutableFile(atPath: candidate.path) {
                return candidate
            }
        }

        return nil
    }

    /// Resolve and return the path string, or nil.
    static func resolvePath(_ name: String) -> String? {
        resolve(name)?.path
    }

    /// Check if a command is available on the system.
    static func isAvailable(_ name: String) -> Bool {
        resolve(name) != nil
    }

    // MARK: - Preferred Paths

    static func preferredPaths() -> [String] {
        let current = ProcessInfo.processInfo.environment["PATH"]?
            .split(separator: ":").map(String.init) ?? []
        let home = FileManager().homeDirectoryForCurrentUser
        let projectRoot = self.projectRoot()
        return preferredPaths(home: home, current: current, projectRoot: projectRoot)
    }

    static func preferredPaths(home: URL, current: [String], projectRoot: URL) -> [String] {
        var extras = [
            home.appendingPathComponent("Library/pnpm").path,
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
        ]
        #if DEBUG
        extras.insert(projectRoot.appendingPathComponent("node_modules/.bin").path, at: 0)
        #endif
        let coreblowPaths = coreblowManagedPaths(home: home)
        if !coreblowPaths.isEmpty {
            extras.insert(contentsOf: coreblowPaths, at: 1)
        }
        extras.insert(contentsOf: nodeManagerBinPaths(home: home), at: 1 + coreblowPaths.count)
        var seen = Set<String>()
        return (extras + current).filter { seen.insert($0).inserted }
    }

    private static func coreblowManagedPaths(home: URL) -> [String] {
        let bases = [
            home.appendingPathComponent(".coreblow"),
        ]
        var paths: [String] = []
        for base in bases {
            let bin = base.appendingPathComponent("bin")
            let nodeBin = base.appendingPathComponent("tools/node/bin")
            if FileManager().fileExists(atPath: bin.path) {
                paths.append(bin.path)
            }
            if FileManager().fileExists(atPath: nodeBin.path) {
                paths.append(nodeBin.path)
            }
        }
        return paths
    }

    private static func nodeManagerBinPaths(home: URL) -> [String] {
        var bins: [String] = []

        // Volta
        let volta = home.appendingPathComponent(".volta/bin")
        if FileManager().fileExists(atPath: volta.path) {
            bins.append(volta.path)
        }

        // asdf
        let asdf = home.appendingPathComponent(".asdf/shims")
        if FileManager().fileExists(atPath: asdf.path) {
            bins.append(asdf.path)
        }

        // fnm
        bins.append(contentsOf: versionedNodeBinPaths(
            base: home.appendingPathComponent(".local/share/fnm/node-versions"),
            suffix: "installation/bin"))

        // nvm
        bins.append(contentsOf: versionedNodeBinPaths(
            base: home.appendingPathComponent(".nvm/versions/node"),
            suffix: "bin"))

        return bins
    }

    private static func versionedNodeBinPaths(base: URL, suffix: String) -> [String] {
        guard FileManager().fileExists(atPath: base.path) else { return [] }
        let entries: [String]
        do {
            entries = try FileManager().contentsOfDirectory(atPath: base.path)
        } catch {
            return []
        }

        func parseVersion(_ name: String) -> [Int] {
            let trimmed = name.hasPrefix("v") ? String(name.dropFirst()) : name
            return trimmed.split(separator: ".").compactMap { Int($0) }
        }

        let sorted = entries.sorted { a, b in
            let va = parseVersion(a)
            let vb = parseVersion(b)
            let maxCount = max(va.count, vb.count)
            for i in 0..<maxCount {
                let ai = i < va.count ? va[i] : 0
                let bi = i < vb.count ? vb[i] : 0
                if ai != bi { return ai > bi }
            }
            return a > b
        }

        var paths: [String] = []
        for entry in sorted {
            let binDir = base.appendingPathComponent(entry).appendingPathComponent(suffix)
            let node = binDir.appendingPathComponent("node")
            if FileManager().isExecutableFile(atPath: node.path) {
                paths.append(binDir.path)
            }
        }
        return paths
    }

    // MARK: - Find Executable

    static func findExecutable(named name: String, searchPaths: [String]? = nil) -> String? {
        for dir in searchPaths ?? preferredPaths() {
            let candidate = (dir as NSString).appendingPathComponent(name)
            if FileManager().isExecutableFile(atPath: candidate) {
                return candidate
            }
        }
        return nil
    }

    static func coreblowExecutable(searchPaths: [String]? = nil) -> String? {
        findExecutable(named: helperName, searchPaths: searchPaths)
    }

    static func projectCoreBlowExecutable(projectRoot: URL? = nil) -> String? {
        #if DEBUG
        let root = projectRoot ?? self.projectRoot()
        let candidate = root.appendingPathComponent("node_modules/.bin").appendingPathComponent(helperName).path
        return FileManager().isExecutableFile(atPath: candidate) ? candidate : nil
        #else
        return nil
        #endif
    }

    static func nodeCliPath() -> String? {
        let root = projectRoot()
        let candidates = [
            root.appendingPathComponent("coreblow.mjs").path,
            root.appendingPathComponent("bin/coreblow.js").path,
        ]
        for candidate in candidates where FileManager().isReadableFile(atPath: candidate) {
            return candidate
        }
        return nil
    }

    static func hasAnyCoreBlowInvoker(searchPaths: [String]? = nil) -> Bool {
        if coreblowExecutable(searchPaths: searchPaths) != nil { return true }
        if findExecutable(named: "pnpm", searchPaths: searchPaths) != nil { return true }
        if findExecutable(named: "node", searchPaths: searchPaths) != nil,
           nodeCliPath() != nil
        {
            return true
        }
        return false
    }

    // MARK: - CoreBlow Node Command

    static func coreblowNodeCommand(
        subcommand: String,
        extraArgs: [String] = [],
        defaults: UserDefaults = .standard,
        configRoot: [String: Any]? = nil,
        searchPaths: [String]? = nil) -> [String]
    {
        let settings = connectionSettings(defaults: defaults, configRoot: configRoot)
        if settings.mode == .remote, let ssh = sshNodeCommand(
            subcommand: subcommand,
            extraArgs: extraArgs,
            settings: settings)
        {
            return ssh
        }

        let root = self.projectRoot()
        if let coreblowPath = projectCoreBlowExecutable(projectRoot: root) {
            return [coreblowPath, subcommand] + extraArgs
        }
        if let coreblowPath = coreblowExecutable(searchPaths: searchPaths) {
            return [coreblowPath, subcommand] + extraArgs
        }

        let runtimeResult = runtimeResolution(searchPaths: searchPaths)
        switch runtimeResult {
        case let .success(runtime):
            if let entry = gatewayEntrypoint(in: root) {
                return makeRuntimeCommand(
                    runtime: runtime,
                    entrypoint: entry,
                    subcommand: subcommand,
                    extraArgs: extraArgs)
            }
        case .failure:
            break
        }

        if let pnpm = findExecutable(named: "pnpm", searchPaths: searchPaths) {
            return [pnpm, "--silent", "coreblow", subcommand] + extraArgs
        }

        switch runtimeResult {
        case .success:
            let missingEntry = """
            coreblow entrypoint missing (looked for dist/index.js or coreblow.mjs); run pnpm build.
            """
            return errorCommand(with: missingEntry)
        case let .failure(error):
            return runtimeErrorCommand(error)
        }
    }

    static func coreblowCommand(
        subcommand: String,
        extraArgs: [String] = [],
        defaults: UserDefaults = .standard,
        configRoot: [String: Any]? = nil,
        searchPaths: [String]? = nil) -> [String]
    {
        coreblowNodeCommand(
            subcommand: subcommand,
            extraArgs: extraArgs,
            defaults: defaults,
            configRoot: configRoot,
            searchPaths: searchPaths)
    }

    // MARK: - SSH Helpers

    private static func sshNodeCommand(subcommand: String, extraArgs: [String], settings: RemoteSettings) -> [String]? {
        guard !settings.target.isEmpty else { return nil }
        guard let parsed = parseSSHTarget(settings.target) else { return nil }

        let exportedPath = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
            "$HOME/Library/pnpm",
            "$PATH",
        ].joined(separator: ":")
        let quotedArgs = ([subcommand] + extraArgs).map(shellQuote).joined(separator: " ")
        let userPRJ = settings.projectRoot.trimmingCharacters(in: .whitespacesAndNewlines)
        let userCLI = settings.cliPath.trimmingCharacters(in: .whitespacesAndNewlines)

        let projectSection = if userPRJ.isEmpty {
            """
            DEFAULT_PRJ="$HOME/Projects/coreblow"
            if [ -d "$DEFAULT_PRJ" ]; then
              PRJ="$DEFAULT_PRJ"
              cd "$PRJ" || { echo "Project root not found: $PRJ"; exit 127; }
            fi
            """
        } else {
            """
            PRJ=\(shellQuote(userPRJ))
            cd "$PRJ" || { echo "Project root not found: $PRJ"; exit 127; }
            """
        }

        let cliSection = if userCLI.isEmpty {
            ""
        } else {
            """
            CLI_HINT=\(shellQuote(userCLI))
            if [ -n "$CLI_HINT" ]; then
              if [ -x "$CLI_HINT" ]; then
                CLI="$CLI_HINT"
                "$CLI_HINT" \(quotedArgs);
                exit $?;
              elif [ -f "$CLI_HINT" ]; then
                if command -v node >/dev/null 2>&1; then
                  CLI="node $CLI_HINT"
                  node "$CLI_HINT" \(quotedArgs);
                  exit $?;
                fi
              fi
            fi
            """
        }

        let scriptBody = """
        PATH=\(exportedPath);
        CLI="";
        \(cliSection)
        \(projectSection)
        if command -v coreblow >/dev/null 2>&1; then
          CLI="$(command -v coreblow)"
          coreblow \(quotedArgs);
        elif [ -n "${PRJ:-}" ] && [ -f "$PRJ/dist/index.js" ]; then
          if command -v node >/dev/null 2>&1; then
            CLI="node $PRJ/dist/index.js"
            node "$PRJ/dist/index.js" \(quotedArgs);
          else
            echo "Node >=22 required on remote host"; exit 127;
          fi
        elif [ -n "${PRJ:-}" ] && [ -f "$PRJ/coreblow.mjs" ]; then
          if command -v node >/dev/null 2>&1; then
            CLI="node $PRJ/coreblow.mjs"
            node "$PRJ/coreblow.mjs" \(quotedArgs);
          else
            echo "Node >=22 required on remote host"; exit 127;
          fi
        elif [ -n "${PRJ:-}" ] && [ -f "$PRJ/bin/coreblow.js" ]; then
          if command -v node >/dev/null 2>&1; then
            CLI="node $PRJ/bin/coreblow.js"
            node "$PRJ/bin/coreblow.js" \(quotedArgs);
          else
            echo "Node >=22 required on remote host"; exit 127;
          fi
        elif command -v pnpm >/dev/null 2>&1; then
          CLI="pnpm --silent coreblow"
          pnpm --silent coreblow \(quotedArgs);
        else
          echo "coreblow CLI missing on remote host"; exit 127;
        fi
        """
        let options: [String] = [
            "-o", "BatchMode=yes",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "UpdateHostKeys=yes",
        ]
        let args = sshArguments(
            target: parsed,
            identity: settings.identity,
            options: options,
            remoteCommand: ["/bin/sh", "-c", scriptBody])
        return ["/usr/bin/ssh"] + args
    }

    // MARK: - Connection Settings

    struct RemoteSettings {
        let mode: AppState.ConnectionMode
        let target: String
        let identity: String
        let projectRoot: String
        let cliPath: String
    }

    static func connectionSettings(
        defaults: UserDefaults = .standard,
        configRoot: [String: Any]? = nil) -> RemoteSettings
    {
        let root = configRoot ?? CoreBlowConfigFile.loadDict()
        let mode = ConnectionModeResolver.resolve(root: root, defaults: defaults).mode
        let target = defaults.string(forKey: "coreblow.remote.target") ?? ""
        let identity = defaults.string(forKey: "coreblow.remote.identity") ?? ""
        let projectRoot = defaults.string(forKey: "coreblow.remote.projectRoot") ?? ""
        let cliPath = defaults.string(forKey: "coreblow.remote.cliPath") ?? ""
        return RemoteSettings(
            mode: mode,
            target: sanitizedTarget(target),
            identity: identity,
            projectRoot: projectRoot,
            cliPath: cliPath)
    }

    static func connectionModeIsRemote(defaults: UserDefaults = .standard) -> Bool {
        connectionSettings(defaults: defaults).mode == .remote
    }

    // MARK: - SSH Target Parsing

    private static func sanitizedTarget(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("ssh ") {
            return trimmed.replacingOccurrences(of: "ssh ", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return trimmed
    }

    struct SSHParsedTarget {
        let user: String?
        let host: String
        let port: Int
    }

    static func parseSSHTarget(_ target: String) -> SSHParsedTarget? {
        let trimmed = normalizeSSHTargetInput(target)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.rangeOfCharacter(from: CharacterSet.whitespacesAndNewlines.union(.controlCharacters)) != nil {
            return nil
        }
        let userHostPort: String
        let user: String?
        if let atRange = trimmed.range(of: "@") {
            user = String(trimmed[..<atRange.lowerBound])
            userHostPort = String(trimmed[atRange.upperBound...])
        } else {
            user = nil
            userHostPort = trimmed
        }

        let host: String
        let port: Int
        if let colon = userHostPort.lastIndex(of: ":"), colon != userHostPort.startIndex {
            host = String(userHostPort[..<colon])
            let portStr = String(userHostPort[userHostPort.index(after: colon)...])
            guard let parsedPort = Int(portStr), parsedPort > 0, parsedPort <= 65535 else {
                return nil
            }
            port = parsedPort
        } else {
            host = userHostPort
            port = 22
        }

        return makeSSHTarget(user: user, host: host, port: port)
    }

    static func sshTargetValidationMessage(_ target: String) -> String? {
        let trimmed = normalizeSSHTargetInput(target)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("-") {
            return "SSH target cannot start with '-'"
        }
        if trimmed.rangeOfCharacter(from: CharacterSet.whitespacesAndNewlines.union(.controlCharacters)) != nil {
            return "SSH target cannot contain spaces"
        }
        if parseSSHTarget(trimmed) == nil {
            return "SSH target must look like user@host[:port]"
        }
        return nil
    }

    // MARK: - Shell Utilities

    private static func shellQuote(_ text: String) -> String {
        if text.isEmpty { return "''" }
        let escaped = text.replacingOccurrences(of: "'", with: "'\\''")
        return "'\(escaped)'"
    }

    private static func expandPath(_ path: String) -> URL? {
        var expanded = path
        if expanded.hasPrefix("~") {
            let home = FileManager().homeDirectoryForCurrentUser.path
            expanded.replaceSubrange(expanded.startIndex...expanded.startIndex, with: home)
        }
        return URL(fileURLWithPath: expanded)
    }

    private static func normalizeSSHTargetInput(_ target: String) -> String {
        var trimmed = target.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("ssh ") {
            trimmed = trimmed.replacingOccurrences(of: "ssh ", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return trimmed
    }

    private static func isValidSSHComponent(_ value: String, allowLeadingDash: Bool = false) -> Bool {
        if value.isEmpty { return false }
        if !allowLeadingDash, value.hasPrefix("-") { return false }
        let invalid = CharacterSet.whitespacesAndNewlines.union(.controlCharacters)
        return value.rangeOfCharacter(from: invalid) == nil
    }

    static func makeSSHTarget(user: String?, host: String, port: Int) -> SSHParsedTarget? {
        let trimmedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidSSHComponent(trimmedHost) else { return nil }
        let trimmedUser = user?.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedUser: String?
        if let trimmedUser {
            guard isValidSSHComponent(trimmedUser) else { return nil }
            normalizedUser = trimmedUser.isEmpty ? nil : trimmedUser
        } else {
            normalizedUser = nil
        }
        guard port > 0, port <= 65535 else { return nil }
        return SSHParsedTarget(user: normalizedUser, host: trimmedHost, port: port)
    }

    private static func sshTargetString(_ target: SSHParsedTarget) -> String {
        target.user.map { "\($0)@\(target.host)" } ?? target.host
    }

    static func sshArguments(
        target: SSHParsedTarget,
        identity: String,
        options: [String],
        remoteCommand: [String] = []) -> [String]
    {
        var args = options
        if target.port > 0 {
            args.append(contentsOf: ["-p", String(target.port)])
        }
        let trimmedIdentity = identity.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedIdentity.isEmpty {
            args.append(contentsOf: ["-o", "IdentitiesOnly=yes"])
            args.append(contentsOf: ["-i", trimmedIdentity])
        }
        args.append("--")
        args.append(sshTargetString(target))
        args.append(contentsOf: remoteCommand)
        return args
    }

    #if SWIFT_PACKAGE
    static func _testNodeManagerBinPaths(home: URL) -> [String] {
        nodeManagerBinPaths(home: home)
    }
    #endif
}
