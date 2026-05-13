import AppKit
import CoreBlowKit
import OSLog
import SwiftUI

private let menuLogger = Logger(subsystem: "ai.coreblow", category: "menu.sessions")

/// Dynamically injects session previews and status items into the menu bar NSMenu.
@MainActor
final class MenuSessionsInjector: NSObject, NSMenuDelegate {
    static let shared = MenuSessionsInjector()

    private let tag = 9_415_557
    private let nodesTag = 9_415_558
    private let fallbackWidth: CGFloat = 320
    private let activeWindowSeconds: TimeInterval = 24 * 60 * 60

    private weak var originalDelegate: NSMenuDelegate?
    private weak var statusItem: NSStatusItem?
    private var loadTask: Task<Void, Never>?
    private var previewTasks: [Task<Void, Never>] = []
    private var isMenuOpen = false
    private var lastKnownMenuWidth: CGFloat?
    private var menuOpenWidth: CGFloat?
    private var isObservingGateway = false

    // Cache
    private var cachedSessions: [SessionPreviewEntry] = []
    private var cachedErrorText: String?
    private var cacheUpdatedAt: Date?
    private let refreshIntervalSeconds: TimeInterval = 12
    private var connectionState: String = "disconnected"

    struct SessionPreviewEntry: Identifiable {
        let id: String
        let label: String
        let lastMessage: String?
        let timestamp: Date?
        let isActive: Bool
        let messageCount: Int
        let sessionKey: String
    }

    // MARK: - Installation

    func install(into statusItem: NSStatusItem) {
        self.statusItem = statusItem
        guard let menu = statusItem.menu else { return }

        // Preserve SwiftUI's internal NSMenuDelegate
        if menu.delegate !== self {
            originalDelegate = menu.delegate
            menu.delegate = self
        }

        if loadTask == nil {
            loadTask = Task { await refreshCache(force: true) }
        }

        startGatewayObservation()
    }

    // MARK: - NSMenuDelegate

    func menuWillOpen(_ menu: NSMenu) {
        originalDelegate?.menuWillOpen?(menu)
        isMenuOpen = true
        menuOpenWidth = currentMenuWidth(for: menu)

        inject(into: menu)

        // Refresh in background for next open
        loadTask?.cancel()
        let forceRefresh = cachedSessions.isEmpty || cachedErrorText != nil
        loadTask = Task { [weak self] in
            guard let self else { return }
            await self.refreshCache(force: forceRefresh)
            await MainActor.run {
                guard self.isMenuOpen else { return }
                self.inject(into: menu)
            }
        }
    }

    func menuDidClose(_ menu: NSMenu) {
        originalDelegate?.menuDidClose?(menu)
        isMenuOpen = false
        menuOpenWidth = nil
        loadTask?.cancel()
        cancelPreviewTasks()
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        originalDelegate?.menuNeedsUpdate?(menu)
    }

    func confinementRect(for menu: NSMenu, on screen: NSScreen?) -> NSRect {
        originalDelegate?.confinementRect?(for: menu, on: screen) ?? .zero
    }

    // MARK: - Gateway Observation

    private func startGatewayObservation() {
        guard !isObservingGateway else { return }
        isObservingGateway = true
        observeGatewayPushes()
    }

    private func observeGatewayPushes() {
        Task { [weak self] in
            let stream = await GatewayConnection.shared.subscribe(bufferingNewest: 1)
            for await push in stream {
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    self?.handlePush(push)
                }
            }
        }
    }

    @MainActor
    private func handlePush(_ push: GatewayPush) {
        // Update connection state from push type
        switch push {
        case .snapshot:
            connectionState = "connected"
        case .event(let evt):
            if evt.event == "disconnected" {
                connectionState = "disconnected"
            } else {
                connectionState = "connected"
            }
        case .seqGap:
            break
        }

        // Force refresh on state change
        if isMenuOpen, let menu = statusItem?.menu {
            loadTask?.cancel()
            loadTask = Task { [weak self, weak menu] in
                guard let self, let menu else { return }
                await self.refreshCache(force: true)
                await MainActor.run {
                    guard self.isMenuOpen else { return }
                    self.inject(into: menu)
                }
            }
        }
    }

    // MARK: - Width Calculation

    private func currentMenuWidth(for menu: NSMenu) -> CGFloat {
        if let existing = menu.items.first(where: { $0.view != nil })?.view?.frame.width, existing > 10 {
            return existing
        }
        return fallbackWidth
    }

    private func initialWidth(for menu: NSMenu) -> CGFloat {
        menuOpenWidth ?? lastKnownMenuWidth ?? fallbackWidth
    }

    private func captureMenuWidthIfAvailable(from view: NSView) {
        let width = view.frame.width
        if width > 10 {
            lastKnownMenuWidth = width
        }
    }

    private func submenuWidth() -> CGFloat {
        (lastKnownMenuWidth ?? fallbackWidth) * 1.2
    }

    // MARK: - Injection

    private func inject(into menu: NSMenu) {
        cancelPreviewTasks()

        // Remove previously injected items
        for item in menu.items where item.tag == tag {
            menu.removeItem(item)
        }

        guard let insertIndex = findInsertIndex(in: menu) else { return }
        let width = initialWidth(for: menu)
        let isConnected = connectionState == "connected"

        var cursor = insertIndex
        var headerView: NSView?

        // Header
        let headerItem = NSMenuItem()
        headerItem.tag = tag
        headerItem.isEnabled = false
        let statusText = cachedErrorText ?? (isConnected ? nil : "Gateway disconnected")
        let hosted = makeHostedView(
            rootView: AnyView(MenuSessionsHeaderView(
                count: cachedSessions.count,
                statusText: statusText)),
            width: width,
            highlighted: false)
        headerItem.view = hosted
        headerView = hosted
        menu.insertItem(headerItem, at: cursor)
        cursor += 1

        if cachedSessions.isEmpty {
            menu.insertItem(
                makeMessageItem(
                    text: isConnected ? "No active sessions" : "Connect the gateway to see sessions",
                    symbolName: isConnected ? "minus" : "bolt.slash",
                    width: width),
                at: cursor)
            cursor += 1
        } else {
            for preview in cachedSessions {
                let item = makeSessionMenuItem(preview, width: width)
                menu.insertItem(item, at: cursor)
                cursor += 1
            }
        }

        // Talk mode item
        let talkSep = NSMenuItem.separator()
        talkSep.tag = tag
        menu.insertItem(talkSep, at: cursor)
        cursor += 1

        let talkItem = NSMenuItem()
        talkItem.tag = tag
        talkItem.title = "Talk Mode"
        talkItem.target = self
        talkItem.action = #selector(toggleTalkMode)
        talkItem.image = NSImage(systemSymbolName: "waveform.circle.fill", accessibilityDescription: nil)
        menu.insertItem(talkItem, at: cursor)
        cursor += 1

        // Separator before settings
        let footerSep = NSMenuItem.separator()
        footerSep.tag = tag
        menu.insertItem(footerSep, at: cursor)
        cursor += 1

        // Settings
        let settingsItem = NSMenuItem()
        settingsItem.tag = tag
        settingsItem.title = "Settings…"
        settingsItem.target = self
        settingsItem.action = #selector(openSettings)
        settingsItem.keyEquivalent = ","
        menu.insertItem(settingsItem, at: cursor)
        cursor += 1

        // Quit
        let quitItem = NSMenuItem()
        quitItem.tag = tag
        quitItem.title = "Quit CoreBlow"
        quitItem.action = #selector(NSApplication.terminate(_:))
        quitItem.keyEquivalent = "q"
        menu.insertItem(quitItem, at: cursor)

        DispatchQueue.main.async { [weak self, weak headerView] in
            guard let self, let headerView else { return }
            self.captureMenuWidthIfAvailable(from: headerView)
        }
    }

    // MARK: - Index Finding

    private func findInsertIndex(in menu: NSMenu) -> Int? {
        // Insert before the last separator or at the end
        if menu.items.isEmpty { return 0 }
        for i in stride(from: menu.items.count - 1, through: 0, by: -1) {
            if menu.items[i].isSeparatorItem && menu.items[i].tag != tag {
                return i
            }
        }
        return 0
    }

    // MARK: - Session Menu Item

    private func makeSessionMenuItem(_ preview: SessionPreviewEntry, width: CGFloat) -> NSMenuItem {
        let item = NSMenuItem()
        item.tag = tag
        item.isEnabled = true
        item.target = self
        item.action = #selector(sessionItemClicked(_:))
        item.representedObject = preview.sessionKey

        // Build submenu for this session
        item.submenu = buildSessionSubmenu(for: preview, width: width)

        let view = makeHostedView(
            rootView: AnyView(SessionMenuRowView(preview: preview, width: width)),
            width: width,
            highlighted: true)
        item.view = view
        return item
    }

    private func buildSessionSubmenu(for preview: SessionPreviewEntry, width: CGFloat) -> NSMenu {
        let menu = NSMenu()
        let subWidth = submenuWidth()

        // Preview header
        let header = NSMenuItem()
        header.isEnabled = false
        header.view = makeHostedView(
            rootView: AnyView(
                VStack(alignment: .leading, spacing: 4) {
                    Text(preview.label)
                        .font(.headline)
                    if let msg = preview.lastMessage {
                        Text(msg)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    }
                    Text("\(preview.messageCount) messages")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .frame(width: subWidth, alignment: .leading)
            ),
            width: subWidth,
            highlighted: false)
        menu.addItem(header)

        menu.addItem(.separator())

        // Copy session key
        let copyItem = NSMenuItem(title: "Copy session key", action: #selector(copySessionKey(_:)), keyEquivalent: "")
        copyItem.target = self
        copyItem.representedObject = preview.sessionKey
        menu.addItem(copyItem)

        return menu
    }

    // MARK: - Hosted View Builder

    private func makeHostedView(rootView: AnyView, width: CGFloat, highlighted: Bool) -> NSView {
        let hosting = NSHostingView(rootView: rootView)
        let size = hosting.fittingSize
        hosting.frame = NSRect(origin: .zero, size: NSSize(width: max(width, 1), height: max(size.height, 20)))
        return hosting
    }

    private func makeMessageItem(text: String, symbolName: String, width: CGFloat) -> NSMenuItem {
        let view = AnyView(
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: symbolName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 14, alignment: .leading)
                    .padding(.top, 1)
                Text(text)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                    .truncationMode(.tail)
                    .fixedSize(horizontal: false, vertical: true)
                    .layoutPriority(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Spacer(minLength: 0)
            }
            .padding(.leading, 18)
            .padding(.trailing, 12)
            .padding(.vertical, 6)
            .frame(width: max(1, width), alignment: .leading))

        let item = NSMenuItem()
        item.tag = tag
        item.isEnabled = false
        item.view = makeHostedView(rootView: view, width: width, highlighted: false)
        return item
    }

    // MARK: - Preview Tasks

    private func cancelPreviewTasks() {
        for task in previewTasks { task.cancel() }
        previewTasks.removeAll()
    }

    // MARK: - Cache

    private func refreshCache(force: Bool) async {
        if !force, let updated = cacheUpdatedAt, Date().timeIntervalSince(updated) < refreshIntervalSeconds {
            return
        }

        // Check gateway connection
        let status = await GatewayConnection.shared.status()
        if !status.ok {
            connectionState = "disconnected"
            if !cachedSessions.isEmpty {
                cachedErrorText = "Gateway disconnected (showing cached)"
            } else {
                cachedErrorText = nil
            }
            cacheUpdatedAt = Date()
            return
        }

        connectionState = "connected"

        do {
            let sessions = AppState.shared.activeSessions
            let now = Date()
            cachedSessions = sessions.map { session in
                SessionPreviewEntry(
                    id: session.id,
                    label: session.displayName ?? session.name ?? session.sessionKey ?? session.id,
                    lastMessage: session.lastMessagePreview,
                    timestamp: session.updatedAt,
                    isActive: session.updatedAt.map { now.timeIntervalSince($0) <= activeWindowSeconds } ?? false,
                    messageCount: session.messageCount,
                    sessionKey: session.sessionKey ?? session.id)
            }
            .filter { $0.isActive || cachedSessions.count < 5 }
            .sorted { ($0.timestamp ?? .distantPast) > ($1.timestamp ?? .distantPast) }

            cachedErrorText = nil
            cacheUpdatedAt = Date()
        }
    }

    // MARK: - Actions

    @objc private func sessionItemClicked(_ sender: NSMenuItem) {
        guard let sessionKey = sender.representedObject as? String else { return }
        menuLogger.info("Session selected: \(sessionKey, privacy: .public)")
    }

    @objc private func copySessionKey(_ sender: NSMenuItem) {
        guard let key = sender.representedObject as? String else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(key, forType: .string)
        menuLogger.info("Copied session key: \(key, privacy: .public)")
    }

    @objc private func toggleTalkMode() {
        Task {
            let isActive = await TalkModeRuntime.shared.isActive
            await TalkModeRuntime.shared.setEnabled(!isActive)
        }
    }

    @objc private func openSettings() {
        SettingsWindowOpener.shared.open()
    }

    // MARK: - Public API

    static func buildSessionItems(_ sessions: [SessionData]) -> [(id: String, label: String)] {
        sessions.map { ($0.id, $0.displayName ?? $0.name ?? $0.sessionKey ?? $0.id) }
    }

    // MARK: - Usage Cache

    private var cachedUsageSummary: GatewayUsageSummary?
    private var cachedUsageErrorText: String?
    private var usageCacheUpdatedAt: Date?
    private let usageRefreshIntervalSeconds: TimeInterval = 30

    private var cachedCostSummary: GatewayCostUsageSummary?
    private var cachedCostErrorText: String?
    private var costCacheUpdatedAt: Date?
    private let costRefreshIntervalSeconds: TimeInterval = 45

    private func refreshUsageCache(force: Bool) async {
        if !force,
           let updated = usageCacheUpdatedAt,
           Date().timeIntervalSince(updated) < usageRefreshIntervalSeconds
        {
            return
        }

        guard connectionState == "connected" else {
            usageCacheUpdatedAt = Date()
            return
        }

        do {
            cachedUsageSummary = try await UsageLoader.loadSummary()
        } catch {
            cachedUsageSummary = nil
            cachedUsageErrorText = nil
        }
        usageCacheUpdatedAt = Date()
    }

    private func refreshCostUsageCache(force: Bool) async {
        if !force,
           let updated = costCacheUpdatedAt,
           Date().timeIntervalSince(updated) < costRefreshIntervalSeconds
        {
            return
        }

        guard connectionState == "connected" else {
            costCacheUpdatedAt = Date()
            return
        }

        do {
            cachedCostSummary = try await CostUsageLoader.loadSummary()
            cachedCostErrorText = nil
        } catch {
            cachedCostSummary = nil
            cachedCostErrorText = compactUsageError(error)
        }
        costCacheUpdatedAt = Date()
    }

    // MARK: - Usage Section Injection

    private func insertUsageSection(into menu: NSMenu, at cursor: Int, width: CGFloat) -> Int {
        guard let summary = cachedUsageSummary else { return cursor }
        let rows = summary.primaryRows()
        if rows.isEmpty { return cursor }

        var cursor = cursor

        if cursor > 0, !menu.items[cursor - 1].isSeparatorItem {
            let separator = NSMenuItem.separator()
            separator.tag = tag
            menu.insertItem(separator, at: cursor)
            cursor += 1
        }

        let headerItem = NSMenuItem()
        headerItem.tag = tag
        headerItem.isEnabled = false
        headerItem.view = makeHostedView(
            rootView: AnyView(MenuUsageHeaderView(count: rows.count)),
            width: width,
            highlighted: false)
        menu.insertItem(headerItem, at: cursor)
        cursor += 1

        for row in rows {
            let item = NSMenuItem()
            item.tag = tag
            item.isEnabled = false
            item.view = makeHostedView(
                rootView: AnyView(UsageMenuLabelView(row: row, width: width)),
                width: width,
                highlighted: false)
            menu.insertItem(item, at: cursor)
            cursor += 1
        }

        return cursor
    }

    private func insertCostUsageSection(into menu: NSMenu, at cursor: Int, width: CGFloat) -> Int {
        guard connectionState == "connected" else { return cursor }
        guard let submenu = buildCostUsageSubmenu(width: width) else { return cursor }
        var cursor = cursor

        if cursor > 0, !menu.items[cursor - 1].isSeparatorItem {
            let separator = NSMenuItem.separator()
            separator.tag = tag
            menu.insertItem(separator, at: cursor)
            cursor += 1
        }

        let item = NSMenuItem(title: "Usage cost (30 days)", action: nil, keyEquivalent: "")
        item.tag = tag
        item.isEnabled = true
        item.image = NSImage(systemSymbolName: "chart.bar.xaxis", accessibilityDescription: nil)
        item.submenu = submenu
        menu.insertItem(item, at: cursor)
        cursor += 1
        return cursor
    }

    private func buildCostUsageSubmenu(width: CGFloat) -> NSMenu? {
        if let error = cachedCostErrorText, !error.isEmpty, cachedCostSummary == nil {
            let menu = NSMenu()
            let item = NSMenuItem(title: error, action: nil, keyEquivalent: "")
            item.isEnabled = false
            menu.addItem(item)
            return menu
        }

        guard let summary = cachedCostSummary else { return nil }
        guard !summary.daily.isEmpty else { return nil }

        let menu = NSMenu()
        let chartView = CostUsageHistoryMenuView(summary: summary, width: width)
        let hosting = NSHostingView(rootView: AnyView(chartView))
        let size = hosting.fittingSize
        hosting.frame = NSRect(origin: .zero, size: NSSize(width: width, height: size.height))

        let chartItem = NSMenuItem()
        chartItem.view = hosting
        chartItem.isEnabled = false
        chartItem.representedObject = "costUsageChart"
        menu.addItem(chartItem)

        return menu
    }

    // MARK: - Nodes Injection

    private var nodesLoadTask: Task<Void, Never>?

    private func injectNodes(into menu: NSMenu) {
        for item in menu.items where item.tag == nodesTag {
            menu.removeItem(item)
        }

        guard let insertIndex = findNodesInsertIndex(in: menu) else { return }
        let width = initialWidth(for: menu)
        var cursor = insertIndex

        let entries = sortedNodeEntries()
        let topSeparator = NSMenuItem.separator()
        topSeparator.tag = nodesTag
        menu.insertItem(topSeparator, at: cursor)
        cursor += 1

        if let gatewayNode = buildGatewayEntry() {
            let gatewayItem = makeNodeItem(entry: gatewayNode, width: width)
            menu.insertItem(gatewayItem, at: cursor)
            cursor += 1
        }

        guard connectionState == "connected" else { return }

        if entries.isEmpty {
            menu.insertItem(
                makeMessageItem(text: "No devices yet", symbolName: "circle.dashed", width: width),
                at: cursor)
            cursor += 1
        } else {
            for entry in entries.prefix(8) {
                let item = makeNodeItem(entry: entry, width: width)
                menu.insertItem(item, at: cursor)
                cursor += 1
            }

            if entries.count > 8 {
                let moreItem = NSMenuItem()
                moreItem.tag = nodesTag
                moreItem.title = "More Devices…"
                moreItem.image = NSImage(systemSymbolName: "ellipsis.circle", accessibilityDescription: nil)
                let overflow = Array(entries.dropFirst(8))
                moreItem.submenu = buildNodesOverflowMenu(entries: overflow, width: width)
                menu.insertItem(moreItem, at: cursor)
                cursor += 1
            }
        }
    }

    private func sortedNodeEntries() -> [NodeInfo] {
        let entries = NodesStore.shared.nodes
        return entries.sorted { lhs, rhs in
            if lhs.isConnected != rhs.isConnected { return lhs.isConnected }
            if lhs.isPaired != rhs.isPaired { return lhs.isPaired }
            let lhsName = (lhs.displayName ?? lhs.nodeId).lowercased()
            let rhsName = (rhs.displayName ?? rhs.nodeId).lowercased()
            if lhsName == rhsName { return lhs.nodeId < rhs.nodeId }
            return lhsName < rhsName
        }
    }

    private func buildGatewayEntry() -> NodeInfo? {
        let isConnected = connectionState == "connected"
        return NodeInfo(
            nodeId: "gateway",
            displayName: "Gateway",
            platform: isConnected ? "local" : nil,
            version: nil,
            coreVersion: nil,
            uiVersion: nil,
            deviceFamily: nil,
            modelIdentifier: nil,
            remoteIp: GatewayConnectivityCoordinator.shared.localEndpointHostLabel,
            caps: nil,
            commands: nil,
            permissions: nil,
            paired: nil,
            connected: isConnected)
    }

    private func makeNodeItem(entry: NodeInfo, width: CGFloat) -> NSMenuItem {
        let item = NSMenuItem()
        item.tag = nodesTag
        item.target = self
        item.action = #selector(copyNodeSummary(_:))
        item.representedObject = NodeMenuEntryFormatter.summaryText(entry)
        item.view = makeHostedView(
            rootView: AnyView(NodeMenuRowView(entry: entry, width: width)),
            width: width,
            highlighted: true)
        item.submenu = buildNodeSubmenu(entry: entry, width: width)
        return item
    }

    private func buildNodesOverflowMenu(entries: [NodeInfo], width: CGFloat) -> NSMenu {
        let menu = NSMenu()
        for entry in entries {
            let item = NSMenuItem()
            item.target = self
            item.action = #selector(copyNodeSummary(_:))
            item.representedObject = NodeMenuEntryFormatter.summaryText(entry)
            item.view = makeHostedView(
                rootView: AnyView(NodeMenuRowView(entry: entry, width: width)),
                width: width,
                highlighted: true)
            item.submenu = buildNodeSubmenu(entry: entry, width: width)
            menu.addItem(item)
        }
        return menu
    }

    private func buildNodeSubmenu(entry: NodeInfo, width: CGFloat) -> NSMenu {
        let menu = NSMenu()
        menu.autoenablesItems = false

        menu.addItem(makeNodeCopyItem(label: "Node ID", value: entry.nodeId))

        if let name = entry.displayName, !name.isEmpty {
            menu.addItem(makeNodeCopyItem(label: "Name", value: name))
        }

        if let ip = entry.remoteIp, !ip.isEmpty {
            menu.addItem(makeNodeCopyItem(label: "IP", value: ip))
        }

        menu.addItem(makeNodeCopyItem(label: "Status", value: NodeMenuEntryFormatter.roleText(entry)))

        if let platform = NodeMenuEntryFormatter.platformText(entry) {
            menu.addItem(makeNodeCopyItem(label: "Platform", value: platform))
        }

        if let version = NodeMenuEntryFormatter.detailRightVersion(entry), !version.isEmpty {
            menu.addItem(makeNodeCopyItem(label: "Version", value: formatVersionLabel(version)))
        }

        menu.addItem(makeNodeDetailItem(label: "Connected", value: entry.isConnected ? "Yes" : "No"))
        menu.addItem(makeNodeDetailItem(label: "Paired", value: entry.isPaired ? "Yes" : "No"))

        if let caps = entry.caps?.filter({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
           !caps.isEmpty
        {
            menu.addItem(makeNodeCopyItem(label: "Caps", value: caps.joined(separator: ", ")))
        }

        if let commands = entry.commands?.filter({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
           !commands.isEmpty
        {
            menu.addItem(makeNodeMultilineItem(
                label: "Commands",
                value: commands.joined(separator: ", "),
                width: width))
        }

        return menu
    }

    private func makeNodeDetailItem(label: String, value: String) -> NSMenuItem {
        let item = NSMenuItem(title: "\(label): \(value)", action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    private func makeNodeCopyItem(label: String, value: String) -> NSMenuItem {
        let item = NSMenuItem(title: "\(label): \(value)", action: #selector(copyNodeValue(_:)), keyEquivalent: "")
        item.target = self
        item.representedObject = value
        return item
    }

    private func makeNodeMultilineItem(label: String, value: String, width: CGFloat) -> NSMenuItem {
        let item = NSMenuItem()
        item.target = self
        item.action = #selector(copyNodeValue(_:))
        item.representedObject = value
        item.view = makeHostedView(
            rootView: AnyView(NodeMenuMultilineView(label: label, value: value, width: width)),
            width: width,
            highlighted: true)
        return item
    }

    // MARK: - Session Submenus (Thinking / Verbose / Preview / Actions)

    private func buildSessionSubmenuFull(for preview: SessionPreviewEntry, width: CGFloat) -> NSMenu {
        let menu = NSMenu()
        let subWidth = submenuWidth()

        // Preview header
        let header = NSMenuItem()
        header.isEnabled = false
        header.view = makeHostedView(
            rootView: AnyView(
                VStack(alignment: .leading, spacing: 4) {
                    Text(preview.label)
                        .font(.headline)
                    if let msg = preview.lastMessage {
                        Text(msg)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                    }
                    Text("\(preview.messageCount) messages")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .frame(width: subWidth, alignment: .leading)
            ),
            width: subWidth,
            highlighted: false)
        menu.addItem(header)

        menu.addItem(.separator())

        // Thinking submenu
        let thinking = NSMenuItem(title: "Thinking", action: nil, keyEquivalent: "")
        thinking.submenu = buildThinkingMenu(for: preview)
        menu.addItem(thinking)

        // Verbose submenu
        let verbose = NSMenuItem(title: "Verbose", action: nil, keyEquivalent: "")
        verbose.submenu = buildVerboseMenu(for: preview)
        menu.addItem(verbose)

        menu.addItem(.separator())

        // Copy session key
        let copyItem = NSMenuItem(title: "Copy session key", action: #selector(copySessionKey(_:)), keyEquivalent: "")
        copyItem.target = self
        copyItem.representedObject = preview.sessionKey
        menu.addItem(copyItem)

        // Reset session
        let reset = NSMenuItem(title: "Reset Session", action: #selector(resetSession(_:)), keyEquivalent: "")
        reset.target = self
        reset.representedObject = preview.sessionKey
        menu.addItem(reset)

        // Compact session log
        let compact = NSMenuItem(title: "Compact Session Log", action: #selector(compactSession(_:)), keyEquivalent: "")
        compact.target = self
        compact.representedObject = preview.sessionKey
        menu.addItem(compact)

        // Delete session (not for main/global)
        if preview.sessionKey != "main", preview.sessionKey != "global" {
            let del = NSMenuItem(title: "Delete Session", action: #selector(deleteSession(_:)), keyEquivalent: "")
            del.target = self
            del.representedObject = preview.sessionKey
            menu.addItem(del)
        }

        return menu
    }

    private func buildThinkingMenu(for preview: SessionPreviewEntry) -> NSMenu {
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.showsStateColumn = true
        let levels = ["off", "minimal", "low", "medium", "high"]
        for level in levels {
            let item = NSMenuItem(title: level.capitalized, action: #selector(patchThinking(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = [
                "key": preview.sessionKey,
                "value": level as Any,
            ]
            item.state = .off
            menu.addItem(item)
        }
        return menu
    }

    private func buildVerboseMenu(for preview: SessionPreviewEntry) -> NSMenu {
        let menu = NSMenu()
        menu.autoenablesItems = false
        menu.showsStateColumn = true
        let levels = ["on", "off"]
        for level in levels {
            let item = NSMenuItem(title: level.capitalized, action: #selector(patchVerbose(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = [
                "key": preview.sessionKey,
                "value": level as Any,
            ]
            item.state = .off
            menu.addItem(item)
        }
        return menu
    }

    // MARK: - Session Actions

    @objc private func patchThinking(_ sender: NSMenuItem) {
        guard let dict = sender.representedObject as? [String: Any],
              let key = dict["key"] as? String
        else { return }
        let value = dict["value"] as? String
        Task {
            do {
                try await SessionActions.patchSession(key: key, thinking: .some(value))
                await refreshCache(force: true)
            } catch {
                await MainActor.run {
                    SessionActions.presentError(title: "Update thinking failed", error: error)
                }
            }
        }
    }

    @objc private func patchVerbose(_ sender: NSMenuItem) {
        guard let dict = sender.representedObject as? [String: Any],
              let key = dict["key"] as? String
        else { return }
        let value = dict["value"] as? String
        Task {
            do {
                try await SessionActions.patchSession(key: key, verbose: .some(value))
                await refreshCache(force: true)
            } catch {
                await MainActor.run {
                    SessionActions.presentError(title: "Update verbose failed", error: error)
                }
            }
        }
    }

    @objc private func resetSession(_ sender: NSMenuItem) {
        guard let key = sender.representedObject as? String else { return }
        Task { @MainActor in
            guard SessionActions.confirmDestructiveAction(
                title: "Reset session?",
                message: "Starts a new session id for \"\(key)\".",
                action: "Reset")
            else { return }

            do {
                try await SessionActions.resetSession(key: key)
                await refreshCache(force: true)
            } catch {
                SessionActions.presentError(title: "Reset failed", error: error)
            }
        }
    }

    @objc private func compactSession(_ sender: NSMenuItem) {
        guard let key = sender.representedObject as? String else { return }
        Task { @MainActor in
            guard SessionActions.confirmDestructiveAction(
                title: "Compact session log?",
                message: "Keeps the last 400 lines; archives the old file.",
                action: "Compact")
            else { return }

            do {
                try await SessionActions.compactSession(key: key, maxLines: 400)
                await refreshCache(force: true)
            } catch {
                SessionActions.presentError(title: "Compact failed", error: error)
            }
        }
    }

    @objc private func deleteSession(_ sender: NSMenuItem) {
        guard let key = sender.representedObject as? String else { return }
        Task { @MainActor in
            guard SessionActions.confirmDestructiveAction(
                title: "Delete session?",
                message: "Deletes the \"\(key)\" entry and archives its transcript.",
                action: "Delete")
            else { return }

            do {
                try await SessionActions.deleteSession(key: key)
                await refreshCache(force: true)
            } catch {
                SessionActions.presentError(title: "Delete failed", error: error)
            }
        }
    }

    @objc private func copyNodeSummary(_ sender: NSMenuItem) {
        guard let summary = sender.representedObject as? String else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(summary, forType: .string)
    }

    @objc private func copyNodeValue(_ sender: NSMenuItem) {
        guard let value = sender.representedObject as? String else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }

    // MARK: - Error Formatting

    private func compactError(_ error: Error) -> String {
        if let loadError = error as? SessionLoadError {
            switch loadError {
            case .gatewayUnavailable:
                return "No connection to gateway"
            case .decodeFailed:
                return "Sessions unavailable"
            }
        }
        return "Sessions unavailable"
    }

    private func compactUsageError(_ error: Error) -> String {
        let message = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if message.isEmpty { return "Usage unavailable" }
        if message.count > 90 { return "\(message.prefix(87))…" }
        return message
    }

    // MARK: - Version Formatting

    private func formatVersionLabel(_ version: String) -> String {
        let trimmed = version.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return version }
        if trimmed.hasPrefix("v") { return trimmed }
        if let first = trimmed.unicodeScalars.first, CharacterSet.decimalDigits.contains(first) {
            return "v\(trimmed)"
        }
        return trimmed
    }

    // MARK: - Width + Placement Helpers

    private func findNodesInsertIndex(in menu: NSMenu) -> Int? {
        findDynamicSectionInsertIndex(in: menu)
    }

    private func findDynamicSectionInsertIndex(in menu: NSMenu) -> Int? {
        if let footerSeparatorIndex = menu.items.lastIndex(where: { item in
            item.isSeparatorItem && !isInjectedItem(item)
        }) {
            return footerSeparatorIndex
        }

        if let firstBaseItemIndex = menu.items.firstIndex(where: { !isInjectedItem($0) }) {
            return min(firstBaseItemIndex + 1, menu.items.count)
        }

        return menu.items.count
    }

    private func isInjectedItem(_ item: NSMenuItem) -> Bool {
        item.tag == tag || item.tag == nodesTag
    }

    private func menuWindowWidth(for menu: NSMenu) -> CGFloat? {
        var menuWindow: NSWindow?
        for item in menu.items {
            if let window = item.view?.window {
                menuWindow = window
                break
            }
        }
        guard let width = menuWindow?.contentView?.bounds.width, width > 0 else { return nil }
        return width
    }
}

// MenuSessionsHeaderView is defined in MenuSessionsHeaderView.swift

// MARK: - Session Menu Row View

private struct SessionMenuRowView: View {
    let preview: MenuSessionsInjector.SessionPreviewEntry
    let width: CGFloat

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Circle()
                .fill(preview.isActive ? Color.green : Color.secondary.opacity(0.3))
                .frame(width: 8, height: 8)
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: 2) {
                Text(preview.label)
                    .font(.callout)
                    .lineLimit(1)
                if let msg = preview.lastMessage {
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .truncationMode(.tail)
                }
                if let ts = preview.timestamp {
                    Text(age(from: ts))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer(minLength: 0)

            Text("\(preview.messageCount)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
                .padding(.top, 2)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .frame(width: max(1, width), alignment: .leading)
    }
}

// NodeMenuRowView is defined in NodesMenu.swift
// NodeMenuMultilineView is defined in NodesMenu.swift


// MARK: - DEBUG Testing Hooks

#if DEBUG
extension MenuSessionsInjector {
    func setTestingConnectionState(_ state: String) {
        connectionState = state
    }

    func setTestingSnapshot(_ sessions: [SessionPreviewEntry], errorText: String? = nil) {
        cachedSessions = sessions
        cachedErrorText = errorText
        cacheUpdatedAt = Date()
    }

    func setTestingUsageSummary(_ summary: GatewayUsageSummary?, errorText: String? = nil) {
        cachedUsageSummary = summary
        cachedUsageErrorText = errorText
        usageCacheUpdatedAt = Date()
    }

    func setTestingCostUsageSummary(_ summary: GatewayCostUsageSummary?, errorText: String? = nil) {
        cachedCostSummary = summary
        cachedCostErrorText = errorText
        costCacheUpdatedAt = Date()
    }

    func injectForTesting(into menu: NSMenu) {
        inject(into: menu)
    }

    func testingFindInsertIndex(in menu: NSMenu) -> Int? {
        findInsertIndex(in: menu)
    }

    func testingFindNodesInsertIndex(in menu: NSMenu) -> Int? {
        findNodesInsertIndex(in: menu)
    }
}
#endif
