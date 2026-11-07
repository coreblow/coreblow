import AppKit
import Foundation
import Observation
import OSLog
import SwiftUI

// ============================================================================
// CoreBlow Studio Models & State (Codex / ChatGPT Desktop Experience)
// ============================================================================

public enum StudioNavRailTab: String, CaseIterable, Identifiable {
    case chat = "Chat"
    case history = "History"
    case coreHub = "CoreHub Store"
    case warRoom = "War Room"
    case memoryWiki = "Memory Wiki"
    case gitWorktree = "Git Worktree"

    public var id: String { self.rawValue }

    public var icon: String {
        switch self {
        case .chat: return "bubble.left.and.bubble.right.fill"
        case .history: return "clock"
        case .coreHub: return "square.grid.2x2"
        case .warRoom: return "person.3"
        case .memoryWiki: return "book.closed"
        case .gitWorktree: return "arrow.triangle.branch"
        }
    }
}

public enum StudioInspectorTab: String, CaseIterable, Identifiable {
    case diffAndGate = "Diff & PR Gate"
    case warRoomKanban = "War Room Kanban"
    case memoryWiki = "Memory & Skills"

    public var id: String { self.rawValue }

    public var icon: String {
        switch self {
        case .diffAndGate: return "checklist.checked"
        case .warRoomKanban: return "square.grid.2x2"
        case .memoryWiki: return "book.closed"
        }
    }
}

public struct StudioProjectFolder: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let isExpanded: Bool
    public let threads: [StudioProjectThread]

    public init(id: String, name: String, isExpanded: Bool = true, threads: [StudioProjectThread] = []) {
        self.id = id
        self.name = name
        self.isExpanded = isExpanded
        self.threads = threads
    }
}

public struct StudioProjectThread: Identifiable, Hashable {
    public let id: String
    public let title: String
    public let isCurrent: Bool

    public init(id: String, title: String, isCurrent: Bool = false) {
        self.id = id
        self.title = title
        self.isCurrent = isCurrent
    }
}

public struct StudioDiffFileItem: Identifiable, Hashable {
    public let id: String
    public let path: String
    public let additions: Int
    public let deletions: Int
    public let status: String // "added" | "modified" | "deleted"

    public init(path: String, additions: Int, deletions: Int, status: String) {
        self.id = path
        self.path = path
        self.additions = additions
        self.deletions = deletions
        self.status = status
    }
}

public struct StudioGateCheckItem: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let passed: Bool
    public let detail: String

    public init(name: String, passed: Bool, detail: String) {
        self.id = name
        self.name = name
        self.passed = passed
        self.detail = detail
    }
}

public struct StudioKanbanCard: Identifiable, Hashable {
    public let id: String
    public let title: String
    public let role: String // "lead" | "coder" | "auditor" | "verifier"
    public let column: String // "Backlog" | "In Progress" | "Review" | "Done"

    public init(id: String, title: String, role: String, column: String) {
        self.id = id
        self.title = title
        self.role = role
        self.column = column
    }
}

public struct StudioChatMessage: Identifiable, Hashable {
    public let id: String
    public let sender: String // "user" | "cory" | "lead" | "coder"
    public let text: String
    public let toolTraceSummary: String?
    public let timestamp: String

    public init(id: String, sender: String, text: String, toolTraceSummary: String? = nil, timestamp: String = "Just now") {
        self.id = id
        self.sender = sender
        self.text = text
        self.toolTraceSummary = toolTraceSummary
        self.timestamp = timestamp
    }
}

@MainActor
@Observable
public final class CoreBlowStudioViewModel {
    // Navigation & View Toggles
    public var activeNavTab: StudioNavRailTab = .chat
    public var isSidebarVisible: Bool = true
    public var isInspectorVisible: Bool = false

    // Active Project & Worktree Context Chips
    public var currentProjectName: String = "coreblow"
    public var currentEnvironment: String = "Local"
    public var currentBranch: String = "main"
    public var executionProfile: String = "Full access" // "Full access" | "Review required" | "Strict sandbox"
    public var selectedModel: String = "6-Tier Router: Coding"

    // Prompt & Chat State
    public var inputPrompt: String = ""
    public var selectedThreadId: String? = "thread_coreblow_1"
    public var selectedInspectorTab: StudioInspectorTab = .diffAndGate
    public var daybreakFailoverReady: Bool = true
    public var decisionRouterTier: String = "coding"
    public var pairedAppName: String = "Xcode"
    public var pairedFilePath: String = "apps/macos/Sources/CoreBlow/CoreBlowStudioView.swift"

    // Project Folders & Chats Tree (Matches Screenshot)
    public var projectFolders: [StudioProjectFolder] = [
        StudioProjectFolder(
            id: "p_coreblow",
            name: "coreblow",
            isExpanded: true,
            threads: [
                StudioProjectThread(id: "thread_coreblow_1", title: "Stage 11 Native Studio & Companion Bar", isCurrent: true),
                StudioProjectThread(id: "thread_coreblow_2", title: "12-Service Microkernel Gateway"),
                StudioProjectThread(id: "thread_coreblow_3", title: "Cory Memory & Wiki Compaction"),
                StudioProjectThread(id: "thread_coreblow_4", title: "EvoLoop Skill Synthesizer"),
            ]
        ),
        StudioProjectFolder(
            id: "p_tradingview",
            name: "tradingview",
            isExpanded: true,
            threads: [
                StudioProjectThread(id: "thread_tv_1", title: "Check Cloudflare Worker Relay..."),
                StudioProjectThread(id: "thread_tv_2", title: "Deep architectural analysis..."),
            ]
        ),
        StudioProjectFolder(
            id: "p_aplesi",
            name: "aplesi",
            isExpanded: true,
            threads: []
        ),
        StudioProjectFolder(
            id: "p_dnda",
            name: "Dnda.my.id",
            isExpanded: true,
            threads: [
                StudioProjectThread(id: "thread_dnda_1", title: "Reply to greeting"),
                StudioProjectThread(id: "thread_dnda_2", title: "Fix display issue"),
                StudioProjectThread(id: "thread_dnda_3", title: "Follow up message"),
            ]
        ),
        StudioProjectFolder(
            id: "p_dxm",
            name: "dxm-scanner",
            isExpanded: true,
            threads: [
                StudioProjectThread(id: "thread_dxm_1", title: "Review professional structure"),
                StudioProjectThread(id: "thread_dxm_2", title: "Reply to greeting"),
                StudioProjectThread(id: "thread_dxm_3", title: "Analyze routing engine"),
                StudioProjectThread(id: "thread_dxm_4", title: "Audit dirty worktree"),
                StudioProjectThread(id: "thread_dxm_5", title: "Understand scanner performance"),
            ]
        ),
        StudioProjectFolder(
            id: "p_coreblow_com",
            name: "coreblow.com",
            isExpanded: true,
            threads: [
                StudioProjectThread(id: "thread_com_1", title: "activate local server and run..."),
            ]
        ),
    ]

    // Messages
    public var messages: [StudioChatMessage] = []

    // Diff & Gate Checks
    public var diffFiles: [StudioDiffFileItem] = [
        StudioDiffFileItem(path: "apps/macos/Sources/CoreBlow/CoreBlowStudioView.swift", additions: 480, deletions: 12, status: "modified"),
        StudioDiffFileItem(path: "src/gateway/macos-codex-companion-bridge.ts", additions: 350, deletions: 0, status: "added"),
        StudioDiffFileItem(path: "src/gateway/microkernel-services.ts", additions: 84, deletions: 6, status: "modified"),
    ]

    public var unifiedDiffPreview: String = """
    --- a/apps/macos/Sources/CoreBlow/CoreBlowStudioView.swift
    +++ b/apps/macos/Sources/CoreBlow/CoreBlowStudioView.swift
    @@ -1,8 +1,28 @@
    + // CoreBlow Studio Desktop Experience (Pixel-Perfect Sovereign UI)
    + NavigationSplitView with custom Far-Left Nav Rail,
    + Collapsible Project Tree, Centered "What should we build in coreblow?",
    + Status Banner Pill, and Floating Multiline Composer Stack.
    """

    public var gateChecks: [StudioGateCheckItem] = [
        StudioGateCheckItem(name: "typecheck", passed: true, detail: "TypeScript check clean with zero errors"),
        StudioGateCheckItem(name: "linter", passed: true, detail: "Oxlint clean with zero warnings across 926 files"),
        StudioGateCheckItem(name: "unit_tests", passed: true, detail: "All 13 test suites (268 tests) passed green"),
        StudioGateCheckItem(name: "secret_scan", passed: true, detail: "Zero raw secrets detected in diff"),
        StudioGateCheckItem(name: "forbidden_paths", passed: true, detail: "100% sovereign brand purity gate verified"),
    ]

    public var kanbanCards: [StudioKanbanCard] = [
        StudioKanbanCard(id: "k1", title: "Codex Desktop Window Aesthetics", role: "lead", column: "Done"),
        StudioKanbanCard(id: "k2", title: "Floating Context Chips Composer", role: "coder", column: "Done"),
        StudioKanbanCard(id: "k3", title: "5-Gate PR Scorecard Evaluator", role: "auditor", column: "Review"),
        StudioKanbanCard(id: "k4", title: "Daybreak Hot Failover Relay", role: "verifier", column: "In Progress"),
    ]

    public var prApproved: Bool = false

    public func startNewChat() {
        self.messages.removeAll()
        self.inputPrompt = ""
    }

    public func selectThread(id: String) {
        self.selectedThreadId = id
        if self.messages.isEmpty {
            self.messages = [
                StudioChatMessage(id: "m1", sender: "user", text: "Review Stage 11 CoreBlow Studio & Companion Bar implementation.", timestamp: "12:00 PM"),
                StudioChatMessage(
                    id: "m2",
                    sender: "cory",
                    text: "Successfully implemented! CoreBlow Studio now features a modern 3-pane desktop view with side Nav Rail, Project Tree, and Floating Composer connected directly to the 12-Service Microkernel.",
                    toolTraceSummary: "Evaluated 12 Microkernel services in 1.2ms · All 5 PR gates green",
                    timestamp: "12:01 PM"
                ),
            ]
        }
    }

    public func sendMessage() {
        let text = self.inputPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        self.messages.append(StudioChatMessage(id: UUID().uuidString, sender: "user", text: text))
        self.inputPrompt = ""

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.messages.append(StudioChatMessage(
                id: UUID().uuidString,
                sender: "cory",
                text: "Processing request in repository [\(self.currentProjectName)] on branch [\(self.currentBranch)] using [\(self.selectedModel)].",
                toolTraceSummary: "Checked active context • Daybreak failover ready"
            ))
        }
    }

    public func approvePR() {
        self.prApproved = true
        self.messages.append(StudioChatMessage(
            id: UUID().uuidString,
            sender: "cory",
            text: "✅ Pull Request approved and certified under Sovereign 5-Gate pre-flight policy.",
            timestamp: "Just now"
        ))
    }
}

// ============================================================================
// CoreBlow Studio Master Desktop View (Sovereign Desktop Canvas)
// ============================================================================

public struct CoreBlowStudioView: View {
    @State private var viewModel = CoreBlowStudioViewModel()

    public init(initialPrompt: String? = nil) {
        if let initialPrompt, !initialPrompt.isEmpty {
            _viewModel = State(initialValue: {
                let vm = CoreBlowStudioViewModel()
                vm.inputPrompt = initialPrompt
                return vm
            }())
        }
    }

    public var body: some View {
        ZStack {
            // Live macOS Acrylic Frosted Glass Vibrancy Background
            VisualEffectView(material: .underWindowBackground, blendingMode: .behindWindow)
                .ignoresSafeArea()

            // Translucent ambient glow bleeding through the glass canvas (Deep Muted Teal & Dark Slate)
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.14, blue: 0.16).opacity(0.38), // Deep Muted Teal #0A2429
                    Color(red: 0.03, green: 0.09, blue: 0.11).opacity(0.35), // Dark Slate #08171C
                    Color(red: 0.02, green: 0.05, blue: 0.07).opacity(0.48)  // Dark Obsidian #050D12
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            HStack(spacing: 0) {
                // 1. Far-Left Vertical Icon Dock (Nav Rail)
                StudioNavRailView(viewModel: self.viewModel)
                    .frame(width: 52)
                    .background(Color.black.opacity(0.28))

                Rectangle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 1)

                // Center Content: CoreHub Manager OR Studio Project Workspace
                if self.viewModel.activeNavTab == .coreHub {
                    StudioCoreHubManagerView(viewModel: self.viewModel)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    // 2. Collapsible Project & Threads Sidebar
                    if self.viewModel.isSidebarVisible {
                        StudioProjectSidebarView(viewModel: self.viewModel)
                            .frame(width: 250)
                            .background(Color.black.opacity(0.18))

                        Rectangle()
                            .fill(Color.white.opacity(0.08))
                            .frame(width: 1)
                    }

                    // 3. Main Center Workspace Canvas (Luminous Translucent Frosted Glass)
                    StudioMainCanvasView(viewModel: self.viewModel)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.06))

                    // 4. Right Inspector (Diff & PR Gate / Kanban / Wiki)
                    if self.viewModel.isInspectorVisible {
                        Rectangle()
                            .fill(Color.white.opacity(0.08))
                            .frame(width: 1)

                        StudioInspectorView(viewModel: self.viewModel)
                            .frame(width: 360)
                            .background(Color.black.opacity(0.24))
                    }
                }
            }
        }
        .frame(minWidth: 1080, minHeight: 700)
        .preferredColorScheme(.dark)
    }
}

// ============================================================================
// 1. Far-Left Vertical Icon Dock (Nav Rail)
// ============================================================================

struct StudioNavRailView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    var body: some View {
        VStack(spacing: 14) {
            // Top Window Traffic Light Safe Space
            Spacer()
                .frame(height: 38)

            // Navigation Icons
            ForEach(StudioNavRailTab.allCases) { tab in
                Button(action: {
                    self.viewModel.activeNavTab = tab
                    if tab == .gitWorktree {
                        self.viewModel.isInspectorVisible = true
                        self.viewModel.selectedInspectorTab = .diffAndGate
                    } else if tab == .warRoom {
                        self.viewModel.isInspectorVisible = true
                        self.viewModel.selectedInspectorTab = .warRoomKanban
                    } else if tab == .memoryWiki {
                        self.viewModel.isInspectorVisible = true
                        self.viewModel.selectedInspectorTab = .memoryWiki
                    }
                }) {
                    ZStack {
                        if self.viewModel.activeNavTab == tab {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Color(white: 0.26))
                                .frame(width: 36, height: 36)
                        }

                        Image(systemName: tab.icon)
                            .font(.system(size: 15))
                            .foregroundStyle(self.viewModel.activeNavTab == tab ? Color.white : Color(white: 0.6))
                    }
                    .frame(width: 44, height: 40)
                }
                .buttonStyle(.plain)
                .help(tab.rawValue)
            }

            Spacer()

            // User Profile Avatar Chip (Bottom)
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color(red: 0.12, green: 0.25, blue: 0.28))
                    .frame(width: 30, height: 30)
                    .overlay(
                        Text("RU")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                    )

                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color(red: 0.11, green: 0.11, blue: 0.12), lineWidth: 1.5))
            }
            .padding(.bottom, 16)
        }
    }
}

// ============================================================================
// 2. Collapsible Project & Threads Sidebar
// ============================================================================

struct StudioProjectSidebarView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Sidebar Header (Model Brand Dropdown + Search)
            HStack(spacing: 8) {
                Menu {
                    Button("CoreBlow v2.0 GA (Local Microkernel)") {}
                    Button("CoreBlow Studio Pro") {}
                    Divider()
                    Button("Manage Workspaces...") {}
                } label: {
                    HStack(spacing: 4) {
                        Text("CoreBlow")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .menuStyle(.borderlessButton)

                Spacer()

                Button(action: {}) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(white: 0.7))
                }
                .buttonStyle(.plain)
                .help("Search chats (⌘K)")
            }
            .padding(.horizontal, 14)
            .padding(.top, 42)
            .padding(.bottom, 12)

            // "New chat" Button
            Button(action: {
                self.viewModel.startNewChat()
            }) {
                HStack(spacing: 8) {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 13, weight: .medium))
                    Text("New chat")
                        .font(.system(size: 13, weight: .medium))
                    Spacer()
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(Color(white: 0.18))
                )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12)
            .padding(.bottom, 14)

            // Section: Projects
            HStack {
                Text("Projects")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(white: 0.55))
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 6)

            // Project Folders & Chats ScrollView
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    ForEach(self.viewModel.projectFolders) { folder in
                        VStack(alignment: .leading, spacing: 4) {
                            // Folder Header
                            HStack(spacing: 6) {
                                Image(systemName: "folder")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color(white: 0.7))
                                Text(folder.name)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.white)
                                Spacer()
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 2)

                            // Nested Threads
                            if folder.threads.isEmpty {
                                Text("No chats")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color(white: 0.45))
                                    .padding(.leading, 32)
                                    .padding(.vertical, 2)
                            } else {
                                ForEach(folder.threads) { thread in
                                    Button(action: {
                                        self.viewModel.currentProjectName = folder.name
                                        self.viewModel.selectThread(id: thread.id)
                                    }) {
                                        HStack {
                                            Text(thread.title)
                                                .font(.system(size: 12))
                                                .foregroundStyle(thread.isCurrent ? Color.white : Color(white: 0.8))
                                                .lineLimit(1)
                                            Spacer()
                                        }
                                        .padding(.leading, 32)
                                        .padding(.trailing, 10)
                                        .padding(.vertical, 4)
                                        .background(
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .fill(thread.isCurrent ? Color(white: 0.22) : Color.clear)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}

// ============================================================================
// 3. Main Center Workspace Canvas (Exact Screenshot Layout)
// ============================================================================

struct StudioMainCanvasView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Top Bar
            HStack(spacing: 12) {
                // Sidebar Toggle Button
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        self.viewModel.isSidebarVisible.toggle()
                    }
                }) {
                    Image(systemName: "sidebar.left")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(white: 0.75))
                }
                .buttonStyle(.plain)
                .help("Toggle sidebar (⇧⌘S)")

                // Back / Forward Chevrons
                HStack(spacing: 12) {
                    Button(action: {}) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(white: 0.45))
                    }
                    .buttonStyle(.plain)

                    Button(action: {}) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(white: 0.45))
                    }
                    .buttonStyle(.plain)
                }

                Spacer()

                // Top Right: Sovereign Badge & Inspector Toggle
                HStack(spacing: 10) {
                    // Sovereign GA Badge Pill
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 11))
                            .foregroundStyle(Color(red: 0.45, green: 0.85, blue: 0.80))
                        Text("Sovereign GA")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(red: 0.65, green: 0.92, blue: 0.88))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color(red: 0.06, green: 0.20, blue: 0.22).opacity(0.85))
                            .overlay(Capsule().stroke(Color(red: 0.45, green: 0.85, blue: 0.80).opacity(0.2), lineWidth: 1))
                    )

                    // Right Inspector Toggle Button
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            self.viewModel.isInspectorVisible.toggle()
                        }
                    }) {
                        Image(systemName: "sidebar.right")
                            .font(.system(size: 14))
                            .foregroundStyle(self.viewModel.isInspectorVisible ? Color.white : Color(white: 0.7))
                    }
                    .buttonStyle(.plain)
                    .help("Toggle Inspector")
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 38)
            .padding(.bottom, 12)

            // Center Content: Either Empty State OR Conversation Stream
            if self.viewModel.messages.isEmpty {
                // Empty State (Matches Screenshot!)
                VStack(spacing: 20) {
                    Spacer()

                    // Glowing CoreBlow Brain / Neural Emblem (Deep Muted Teal & Ice-Cyan)
                    ZStack {
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [
                                        Color(red: 0.08, green: 0.28, blue: 0.30).opacity(0.45),
                                        Color(red: 0.04, green: 0.14, blue: 0.16).opacity(0.20),
                                        Color.clear
                                    ],
                                    center: .center,
                                    startRadius: 10,
                                    endRadius: 55
                                )
                            )
                            .frame(width: 80, height: 80)

                        Image(systemName: "brain.head.profile")
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(width: 50, height: 50)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.38, green: 0.85, blue: 0.80),
                                        Color(red: 0.18, green: 0.55, blue: 0.52)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }

                    // Prominent Heading
                    Text("What should we build in \(self.viewModel.currentProjectName)?")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(.white)

                    // Luminous Glass Context Chips
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "folder")
                                .font(.system(size: 10))
                            Text(self.viewModel.currentProjectName)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color.white.opacity(0.85))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.white.opacity(0.08))
                                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.white.opacity(0.14), lineWidth: 1))
                        )

                        HStack(spacing: 4) {
                            Image(systemName: "macwindow")
                                .font(.system(size: 10))
                            Text(self.viewModel.currentEnvironment)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color.white.opacity(0.85))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.white.opacity(0.08))
                                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.white.opacity(0.14), lineWidth: 1))
                        )

                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.branch")
                                .font(.system(size: 10))
                            Text(self.viewModel.currentBranch)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color.white.opacity(0.85))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Color.white.opacity(0.08))
                                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.white.opacity(0.14), lineWidth: 1))
                        )
                    }

                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                // Active Conversation List
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(self.viewModel.messages) { message in
                            StudioMessageBubbleView(message: message)
                        }
                    }
                    .padding(.horizontal, 36)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
            }

            // Bottom Floating Stack (Matches Screenshot!)
            VStack(spacing: 8) {
                // 1. Status / Router Info Banner Card
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("CoreBlow 6-Tier Decision Router · Daybreak Failover Ready")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Text("Active Tier: [\(self.viewModel.decisionRouterTier.uppercased())] · 12 Microkernel Services Green · Offline Local-First")
                            .font(.system(size: 11))
                            .foregroundStyle(Color(white: 0.6))
                    }

                    Spacer()

                    Button(action: {
                        self.viewModel.isInspectorVisible = true
                        self.viewModel.selectedInspectorTab = .diffAndGate
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 10))
                            Text("PR Gates")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(Color(white: 0.28))
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(red: 0.18, green: 0.18, blue: 0.19))
                )

                // 2. Floating Composer Box
                VStack(spacing: 0) {
                    // Top Context Chips Bar
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "folder")
                                .font(.system(size: 10))
                            Text(self.viewModel.currentProjectName)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color(white: 0.8))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color(white: 0.18))
                        )

                        HStack(spacing: 4) {
                            Image(systemName: "macwindow")
                                .font(.system(size: 10))
                            Text(self.viewModel.currentEnvironment)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color(white: 0.8))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color(white: 0.18))
                        )

                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.branch")
                                .font(.system(size: 10))
                            Text(self.viewModel.currentBranch)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(Color(white: 0.8))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color(white: 0.18))
                        )

                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 10)
                    .padding(.bottom, 6)

                    // Text Input Area
                    TextField("Do anything", text: self.$viewModel.inputPrompt, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14))
                        .lineLimit(1...5)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .onSubmit {
                            self.viewModel.sendMessage()
                        }

                    // Bottom Action Toolbar
                    HStack(spacing: 10) {
                        // Left: + Attach button
                        Button(action: {}) {
                            Image(systemName: "plus")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color(white: 0.6))
                        }
                        .buttonStyle(.plain)

                        // Full access / Security profile chip
                        Menu {
                            Button("Full access") { self.viewModel.executionProfile = "Full access" }
                            Button("Review required") { self.viewModel.executionProfile = "Review required" }
                            Button("Strict sandbox") { self.viewModel.executionProfile = "Strict sandbox" }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "shield.checkered")
                                    .font(.system(size: 10))
                                Text(self.viewModel.executionProfile)
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .foregroundStyle(Color(red: 0.45, green: 0.85, blue: 0.80))
                        }
                        .menuStyle(.borderlessButton)

                        Spacer()

                        // Right: Model Selector Dropdown
                        Menu {
                            Button("6-Tier Router: Auto") { self.viewModel.selectedModel = "6-Tier Router: Auto" }
                            Button("6-Tier Router: Coding") { self.viewModel.selectedModel = "6-Tier Router: Coding" }
                            Button("6-Tier Router: Deep Reasoning") { self.viewModel.selectedModel = "6-Tier Router: Deep Reasoning" }
                            Button("Local Ollama Engine") { self.viewModel.selectedModel = "Local Ollama Engine" }
                        } label: {
                            HStack(spacing: 4) {
                                Text(self.viewModel.selectedModel)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(Color(white: 0.75))
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 8))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .menuStyle(.borderlessButton)

                        // Apple Silicon MLX Voice Button
                        Button(action: {
                            StudioCompanionBarController.shared.toggle()
                        }) {
                            Image(systemName: "mic.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(Color(white: 0.6))
                        }
                        .buttonStyle(.plain)
                        .help("Voice companion (⌥Space)")

                        // Send Button (Teal circle with upward arrow)
                        Button(action: {
                            self.viewModel.sendMessage()
                        }) {
                            ZStack {
                                Circle()
                                    .fill(Color(red: 0.10, green: 0.52, blue: 0.48))
                                    .frame(width: 26, height: 26)

                                Image(systemName: "arrow.up")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 10)
                }
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(Color.white.opacity(0.16), lineWidth: 1)
                        )
                        .shadow(color: Color.black.opacity(0.25), radius: 14, x: 0, y: 7)
                )
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
    }
}

// ============================================================================
// Message Bubble View
// ============================================================================

struct StudioMessageBubbleView: View {
    let message: StudioChatMessage
    @State private var isTraceExpanded: Bool = false

    var isUser: Bool {
        message.sender == "user"
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if !self.isUser {
                // Agent Avatar
                ZStack {
                    Circle()
                        .fill(Color(red: 0.08, green: 0.24, blue: 0.26))
                        .frame(width: 30, height: 30)

                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(red: 0.45, green: 0.85, blue: 0.80))
                }
            } else {
                Spacer(minLength: 40)
            }

            VStack(alignment: self.isUser ? .trailing : .leading, spacing: 6) {
                // Sender label & time
                HStack(spacing: 6) {
                    Text(self.isUser ? "You" : "Cory")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                    Text(self.message.timestamp)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }

                // Message Text
                Text(self.message.text)
                    .font(.system(size: 13))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(self.isUser ? Color(red: 0.08, green: 0.28, blue: 0.30) : Color(white: 0.18))
                    )

                // Collapsible Tool Trace Card
                if let trace = message.toolTraceSummary {
                    VStack(alignment: .leading, spacing: 4) {
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.15)) {
                                self.isTraceExpanded.toggle()
                            }
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: self.isTraceExpanded ? "chevron.down" : "chevron.right")
                                    .font(.system(size: 9))
                                Image(systemName: "wrench.and.screwdriver")
                                    .font(.system(size: 10))
                                Text("Tool Execution Trace")
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .foregroundStyle(Color(white: 0.7))
                        }
                        .buttonStyle(.plain)

                        if self.isTraceExpanded {
                            Text(trace)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(Color(white: 0.8))
                                .padding(8)
                                .background(
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(Color(white: 0.15))
                                )
                        }
                    }
                    .padding(.top, 2)
                }
            }

            if self.isUser {
                // User Avatar
                ZStack {
                    Circle()
                        .fill(Color(red: 0.12, green: 0.25, blue: 0.28))
                        .frame(width: 30, height: 30)

                    Text("RU")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }
            } else {
                Spacer(minLength: 40)
            }
        }
    }
}

// ============================================================================
// 4. Right Inspector View (Diff, 5-Gate Scorecard, Kanban, Wiki)
// ============================================================================

struct StudioInspectorView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Inspector Tab Bar
            HStack(spacing: 6) {
                ForEach(StudioInspectorTab.allCases) { tab in
                    Button(action: {
                        self.viewModel.selectedInspectorTab = tab
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 10))
                            Text(tab.rawValue)
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(self.viewModel.selectedInspectorTab == tab ? Color.white : Color(white: 0.6))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(self.viewModel.selectedInspectorTab == tab ? Color(white: 0.22) : Color.clear)
                        )
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.top, 40)
            .padding(.bottom, 10)

            Divider()

            // Inspector Tab Content
            switch self.viewModel.selectedInspectorTab {
            case .diffAndGate:
                StudioDiffAndGateView(viewModel: self.viewModel)
            case .warRoomKanban:
                StudioKanbanView(viewModel: self.viewModel)
            case .memoryWiki:
                StudioMemoryWikiView(viewModel: self.viewModel)
            }
        }
    }
}

struct StudioDiffAndGateView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // 5-Gate Scorecard
                VStack(alignment: .leading, spacing: 8) {
                    Text("5-GATE PRE-FLIGHT SCORECARD")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.secondary)

                    ForEach(self.viewModel.gateChecks) { check in
                        HStack(spacing: 8) {
                            Image(systemName: check.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundStyle(check.passed ? .green : .red)
                                .font(.system(size: 12))

                            VStack(alignment: .leading, spacing: 1) {
                                Text(check.name.uppercased())
                                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                Text(check.detail)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color(white: 0.16)))

                // Changed Files List
                VStack(alignment: .leading, spacing: 6) {
                    Text("CHANGED FILES (\(self.viewModel.diffFiles.count))")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.secondary)

                    ForEach(self.viewModel.diffFiles) { file in
                        HStack {
                            Text(file.path)
                                .font(.system(size: 11, design: .monospaced))
                                .lineLimit(1)

                            Spacer()

                            HStack(spacing: 4) {
                                Text("+\(file.additions)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.green)
                                Text("-\(file.deletions)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(.vertical, 3)
                    }
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color(white: 0.16)))

                // Unified Diff Snippet Preview
                VStack(alignment: .leading, spacing: 6) {
                    Text("UNIFIED DIFF PREVIEW")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.secondary)

                    Text(self.viewModel.unifiedDiffPreview)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(.white)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.black.opacity(0.4))
                        .cornerRadius(6)
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color(white: 0.16)))

                // Approve PR Button
                Button(action: {
                    self.viewModel.approvePR()
                }) {
                    HStack {
                        Spacer()
                        Image(systemName: self.viewModel.prApproved ? "checkmark.seal.fill" : "arrow.triangle.merge")
                        Text(self.viewModel.prApproved ? "PR Approved & Certified" : "Approve & Certify PR")
                            .font(.system(size: 13, weight: .bold))
                        Spacer()
                    }
                    .padding(.vertical, 10)
                    .foregroundStyle(.white)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(self.viewModel.prApproved ? Color.green : Color.blue)
                    )
                }
                .buttonStyle(.plain)
                .disabled(self.viewModel.prApproved)
            }
            .padding(14)
        }
    }
}

struct StudioKanbanView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    let columns = ["Backlog", "In Progress", "Review", "Done"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(self.columns, id: \.self) { col in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(col.uppercased())
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.secondary)

                        let colCards = self.viewModel.kanbanCards.filter { $0.column == col }
                        if colCards.isEmpty {
                            Text("No items")
                                .font(.system(size: 11))
                                .foregroundStyle(Color(white: 0.4))
                                .padding(.vertical, 4)
                        } else {
                            ForEach(colCards) { card in
                                StudioKanbanCardItemView(card: card)
                            }
                        }
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(white: 0.16)))
                }
            }
            .padding(14)
        }
    }
}

struct StudioKanbanCardItemView: View {
    let card: StudioKanbanCard

    var body: some View {
        HStack {
            Text(self.card.title)
                .font(.system(size: 11, weight: .medium))
            Spacer()
            Text(self.card.role)
                .font(.system(size: 9, weight: .bold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Capsule().fill(Color.accentColor.opacity(0.3)))
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 6).fill(Color(white: 0.22)))
    }
}

struct StudioMemoryWikiView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("CORY PERSISTENT MEMORY WIKI")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)

                ForEach(["USER.md", "MEMORY.md", "CONSTRAINTS.md"], id: \.self) { file in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "doc.text.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.accentColor)
                            Text(file)
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            Spacer()
                            Text("Indexed")
                                .font(.system(size: 9))
                                .foregroundStyle(.green)
                        }
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(white: 0.16)))
                }
            }
            .padding(14)
        }
    }
}

// ============================================================================
// CoreHub Desktop & Studio App Manager View (Option 1 Palette)
// Deep Muted Teal #0A2429, Dark Slate #08171C, Dark Obsidian #050D12,
// Muted Cyan #1A857A, Ice-Cyan #60D9CC, Sage Green #5AB982
// ============================================================================

public enum CoreHubTopNavTab: String, CaseIterable, Identifiable {
    case apps = "Apps"
    case yourWork = "Your work"
    case discover = "Discover"
    case market = "Market"

    public var id: String { self.rawValue }
}

public enum CoreHubPlatformFilter: String, CaseIterable, Identifiable {
    case all = "All Apps"
    case desktop = "Desktop"
    case mobile = "Mobile"
    case web = "Web"

    public var id: String { self.rawValue }
}

public enum CoreHubCategory: String, CaseIterable, Identifiable {
    case allApps = "All Apps"
    case updates = "Updates (3)"
    case autonomousAgents = "Autonomous Agents"
    case evoLoopSkills = "EvoLoop Skills"
    case devTools = "Dev Tools"
    case mcpBridges = "MCP Bridges"
    case memoryWiki = "Memory & Wiki"

    public var id: String { self.rawValue }

    public var icon: String {
        switch self {
        case .allApps: return "square.grid.2x2"
        case .updates: return "arrow.triangle.2.circlepath.circle"
        case .autonomousAgents: return "person.2.badge.gearshape"
        case .evoLoopSkills: return "bolt.arrow.trianglehead.counterclockwise"
        case .devTools: return "wrench.and.screwdriver"
        case .mcpBridges: return "network"
        case .memoryWiki: return "brain.head.profile"
        }
    }
}

public struct CoreHubInstalledAppItem: Identifiable {
    public let id: String
    public var name: String
    public var description: String
    public var version: String
    public let icon: String
    public var isUpdateAvailable: Bool
    public let category: CoreHubCategory
    public let platforms: Set<CoreHubPlatformFilter>

    public init(
        id: String,
        name: String,
        description: String,
        version: String,
        icon: String,
        isUpdateAvailable: Bool,
        category: CoreHubCategory,
        platforms: Set<CoreHubPlatformFilter> = [.desktop]
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.version = version
        self.icon = icon
        self.isUpdateAvailable = isUpdateAvailable
        self.category = category
        self.platforms = platforms
    }
}

public struct CoreHubPackageItem: Identifiable {
    public let id: String
    public var name: String
    public var description: String
    public let tierBadge: String
    public let icon: String
    public let isLocked: Bool
    public let wilsonScore: Double?
    public var isInstalled: Bool
    public let category: CoreHubCategory
    public let platforms: Set<CoreHubPlatformFilter>

    public init(
        id: String,
        name: String,
        description: String,
        tierBadge: String,
        icon: String,
        isLocked: Bool,
        wilsonScore: Double?,
        isInstalled: Bool,
        category: CoreHubCategory,
        platforms: Set<CoreHubPlatformFilter> = [.desktop]
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.tierBadge = tierBadge
        self.icon = icon
        self.isLocked = isLocked
        self.wilsonScore = wilsonScore
        self.isInstalled = isInstalled
        self.category = category
        self.platforms = platforms
    }
}

public struct StudioCoreHubManagerView: View {
    @Bindable var viewModel: CoreBlowStudioViewModel

    // Navigation and Filter States
    @State private var selectedTopTab: CoreHubTopNavTab = .apps
    @State private var selectedPlatform: CoreHubPlatformFilter = .all
    @State private var selectedCategory: CoreHubCategory = .allApps
    @State private var searchText: String = ""

    // Color definitions (Option 1 Palette)
    private let deepMutedTeal = Color(red: 10/255.0, green: 36/255.0, blue: 41/255.0)     // #0A2429
    private let darkSlate = Color(red: 8/255.0, green: 23/255.0, blue: 28/255.0)         // #08171C
    private let darkObsidian = Color(red: 5/255.0, green: 13/255.0, blue: 18/255.0)      // #050D12
    private let mutedCyan = Color(red: 26/255.0, green: 133/255.0, blue: 122/255.0)      // #1A857A
    private let iceCyan = Color(red: 96/255.0, green: 217/255.0, blue: 204/255.0)        // #60D9CC
    private let sageGreen = Color(red: 90/255.0, green: 185/255.0, blue: 130/255.0)      // Updated dot

    // Installed Microkernel & Desktop Apps (Dynamic State)
    @State private var installedApps: [CoreHubInstalledAppItem] = [
        CoreHubInstalledAppItem(
            id: "app_studio",
            name: "CoreBlow Studio",
            description: "Native 3-pane macOS workspace with floating context chips & Microkernel IPC",
            version: "v2.0.0 GA",
            icon: "macwindow.on.rectangle",
            isUpdateAvailable: false,
            category: .devTools,
            platforms: [.desktop]
        ),
        CoreHubInstalledAppItem(
            id: "app_companion",
            name: "Companion Bar (⌥Space)",
            description: "Floating system quick-launch bar with active window context pairing",
            version: "v2.0.0 GA",
            icon: "command.square.fill",
            isUpdateAvailable: false,
            category: .devTools,
            platforms: [.desktop]
        ),
        CoreHubInstalledAppItem(
            id: "app_memory",
            name: "Cory 4-Layer Memory",
            description: "SQLite WAL + FTS5 BM25 associative memory with continuous compaction",
            version: "v2.0.1",
            icon: "brain",
            isUpdateAvailable: true,
            category: .memoryWiki,
            platforms: [.desktop, .mobile, .web]
        ),
        CoreHubInstalledAppItem(
            id: "app_evoloop",
            name: "EvoLoop Synthesizer",
            description: "Closed-loop skill distillation & Bayesian Wilson score ranking (z=1.28)",
            version: "v2.0.0 GA",
            icon: "bolt.fill",
            isUpdateAvailable: false,
            category: .evoLoopSkills,
            platforms: [.desktop, .mobile, .web]
        ),
        CoreHubInstalledAppItem(
            id: "app_war_room",
            name: "War Room Orchestrator",
            description: "Lead-agent multi-worker task orchestration & DAG state machine flow",
            version: "v2.0.2",
            icon: "person.3.fill",
            isUpdateAvailable: true,
            category: .autonomousAgents,
            platforms: [.desktop, .web]
        ),
        CoreHubInstalledAppItem(
            id: "app_mlx_voice",
            name: "Sovereign MLX Voice",
            description: "Local Apple Silicon Neural Engine TTS with real-time telemetry (RTF ≤ 0.4)",
            version: "v2.0.0",
            icon: "waveform",
            isUpdateAvailable: true,
            category: .devTools,
            platforms: [.desktop]
        )
    ]

    // Available Two-Tier Packages (Dynamic State)
    @State private var availablePackages: [CoreHubPackageItem] = [
        CoreHubPackageItem(
            id: "pkg_mcp",
            name: "@coreblow/mcp-bridge",
            description: "Model Context Protocol JSON-RPC & Stdio transport bridge exposing all 6 Microkernel tools",
            tierBadge: "Tier A: Plugin",
            icon: "network",
            isLocked: false,
            wilsonScore: nil,
            isInstalled: true,
            category: .mcpBridges,
            platforms: [.desktop, .web]
        ),
        CoreHubPackageItem(
            id: "pkg_discord",
            name: "@coreblow/discord",
            description: "Gateway messaging channel adapter for Discord bots, threads & webhooks",
            tierBadge: "Tier A: Plugin",
            icon: "bubble.left.and.text.bubble.right.fill",
            isLocked: false,
            wilsonScore: nil,
            isInstalled: false,
            category: .devTools,
            platforms: [.desktop, .web, .mobile]
        ),
        CoreHubPackageItem(
            id: "pkg_telegram",
            name: "@coreblow/telegram",
            description: "Direct Telegram Bot API gateway driver with streaming responses & voice notes",
            tierBadge: "Tier A: Plugin",
            icon: "paperplane.fill",
            isLocked: false,
            wilsonScore: nil,
            isInstalled: false,
            category: .devTools,
            platforms: [.desktop, .web, .mobile]
        ),
        CoreHubPackageItem(
            id: "pkg_git_supercharged",
            name: "skill/git-supercharged",
            description: "Advanced git worktree staging, branch hygiene, and conflict resolution",
            tierBadge: "Tier B: Skill",
            icon: "arrow.triangle.branch",
            isLocked: true,
            wilsonScore: 0.98,
            isInstalled: false,
            category: .evoLoopSkills,
            platforms: [.desktop]
        ),
        CoreHubPackageItem(
            id: "pkg_rust_advisor",
            name: "skill/rust-compiler-advisor",
            description: "Rust borrow checker diagnostic reasoning and cargo workspace tuning",
            tierBadge: "Tier B: Skill",
            icon: "gearshape.2.fill",
            isLocked: true,
            wilsonScore: 0.95,
            isInstalled: false,
            category: .evoLoopSkills,
            platforms: [.desktop]
        ),
        CoreHubPackageItem(
            id: "pkg_audit_guard",
            name: "skill/sovereign-audit-guard",
            description: "Zero-trust AST verification, secret pattern scanner & 5-gate evaluator",
            tierBadge: "Tier B: Skill",
            icon: "shield.checkerboard",
            isLocked: true,
            wilsonScore: 0.99,
            isInstalled: false,
            category: .autonomousAgents,
            platforms: [.desktop, .web]
        )
    ]

    private var updatesCount: Int {
        self.installedApps.filter { $0.isUpdateAvailable }.count
    }

    private func categoryCount(for category: CoreHubCategory) -> Int? {
        switch category {
        case .allApps:
            return self.installedApps.count + self.availablePackages.count
        case .updates:
            return self.updatesCount
        case .autonomousAgents:
            let installed = self.installedApps.filter { $0.category == .autonomousAgents }.count
            let available = self.availablePackages.filter { $0.category == .autonomousAgents }.count
            return installed + available
        case .evoLoopSkills:
            let installed = self.installedApps.filter { $0.category == .evoLoopSkills }.count
            let available = self.availablePackages.filter { $0.category == .evoLoopSkills }.count
            return installed + available
        case .devTools:
            let installed = self.installedApps.filter { $0.category == .devTools }.count
            let available = self.availablePackages.filter { $0.category == .devTools }.count
            return installed + available
        case .mcpBridges:
            let installed = self.installedApps.filter { $0.category == .mcpBridges }.count
            let available = self.availablePackages.filter { $0.category == .mcpBridges }.count
            return installed + available
        case .memoryWiki:
            let installed = self.installedApps.filter { $0.category == .memoryWiki }.count
            let available = self.availablePackages.filter { $0.category == .memoryWiki }.count
            return installed + available
        }
    }

    private var filteredInstalledApps: [CoreHubInstalledAppItem] {
        self.installedApps.filter { app in
            if self.selectedTopTab == .market {
                return false
            }
            if self.selectedCategory == .updates {
                if !app.isUpdateAvailable { return false }
            } else if self.selectedCategory != .allApps {
                if app.category != self.selectedCategory { return false }
            }
            if self.selectedPlatform != .all {
                if !app.platforms.contains(self.selectedPlatform) { return false }
            }
            let trimmedSearch = self.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedSearch.isEmpty {
                let term = trimmedSearch.lowercased()
                let matchesName = app.name.localizedCaseInsensitiveContains(term)
                let matchesDesc = app.description.localizedCaseInsensitiveContains(term)
                let matchesCategory = app.category.rawValue.localizedCaseInsensitiveContains(term)
                if !matchesName && !matchesDesc && !matchesCategory {
                    return false
                }
            }
            return true
        }
    }

    private var filteredAvailablePackages: [CoreHubPackageItem] {
        self.availablePackages.filter { pkg in
            if self.selectedCategory == .updates {
                return false
            } else if self.selectedCategory != .allApps {
                if pkg.category != self.selectedCategory { return false }
            }
            if self.selectedPlatform != .all {
                if !pkg.platforms.contains(self.selectedPlatform) { return false }
            }
            if self.selectedTopTab == .yourWork {
                if !pkg.isInstalled { return false }
            }
            let trimmedSearch = self.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedSearch.isEmpty {
                let term = trimmedSearch.lowercased()
                let matchesName = pkg.name.localizedCaseInsensitiveContains(term)
                let matchesDesc = pkg.description.localizedCaseInsensitiveContains(term)
                let matchesTier = pkg.tierBadge.localizedCaseInsensitiveContains(term)
                let matchesCategory = pkg.category.rawValue.localizedCaseInsensitiveContains(term)
                if !matchesName && !matchesDesc && !matchesTier && !matchesCategory {
                    return false
                }
            }
            return true
        }
    }

    private func updateApp(id: String) {
        if let idx = self.installedApps.firstIndex(where: { $0.id == id }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                self.installedApps[idx].isUpdateAvailable = false
                self.installedApps[idx].version = "\(self.installedApps[idx].version) GA"
            }
        }
    }

    private func installPackage(id: String) {
        if let idx = self.availablePackages.firstIndex(where: { $0.id == id }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                self.availablePackages[idx].isInstalled = true
            }
        }
    }

    private func openApp(id: String) {
        switch id {
        case "app_studio":
            self.viewModel.activeNavTab = .chat
        case "app_war_room":
            self.viewModel.activeNavTab = .warRoom
            self.viewModel.isInspectorVisible = true
            self.viewModel.selectedInspectorTab = .warRoomKanban
        case "app_memory":
            self.viewModel.activeNavTab = .memoryWiki
            self.viewModel.isInspectorVisible = true
            self.viewModel.selectedInspectorTab = .memoryWiki
        case "app_companion":
            NotificationCenter.default.post(name: NSNotification.Name("ToggleCompanionBar"), object: nil)
        default:
            break
        }
    }

    public var body: some View {
        VStack(spacing: 0) {
            // a) Top Navigation Bar
            topNavigationBar

            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1)

            // b) Platform Filter Sub-Header
            platformFilterSubHeader

            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1)

            // Lower Split: c) Left Category Sidebar + d) Central Canvas
            HStack(spacing: 0) {
                // c) Left Category Sidebar
                categorySidebar
                    .frame(width: 220)
                    .background(self.darkObsidian.opacity(0.65))

                Rectangle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 1)

                // d) Central Canvas
                centralCanvas
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(self.darkSlate.opacity(0.45))
            }
        }
    }

    // ========================================================================
    // a) Top Navigation Bar
    // ========================================================================
    private var topNavigationBar: some View {
        HStack(spacing: 16) {
            // Navigation Tabs
            HStack(spacing: 4) {
                ForEach(CoreHubTopNavTab.allCases) { tab in
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            self.selectedTopTab = tab
                        }
                    }) {
                        Text(tab.rawValue)
                            .font(.system(size: 13, weight: self.selectedTopTab == tab ? .semibold : .medium))
                            .foregroundStyle(self.selectedTopTab == tab ? Color.white : Color.white.opacity(0.65))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(self.selectedTopTab == tab ? self.mutedCyan.opacity(0.4) : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Global Search Field
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.white.opacity(0.45))

                TextField("🔍 Search CoreHub...", text: self.$searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .foregroundStyle(.white)

                if !self.searchText.isEmpty {
                    Button(action: { self.searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.white.opacity(0.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(self.darkObsidian.opacity(0.85))
                    .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                )
            )
            .frame(maxWidth: 320)

            Spacer()

            // Sync Status Indicator
            HStack(spacing: 6) {
                Circle()
                    .fill(self.sageGreen)
                    .frame(width: 7, height: 7)
                Text("Gateway Synced")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.75))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(self.deepMutedTeal.opacity(0.6))
                    .overlay(Capsule().stroke(self.mutedCyan.opacity(0.3), lineWidth: 1))
            )

            // Notification Bell with Badge (dynamic updates count)
            ZStack(alignment: .topTrailing) {
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        self.selectedCategory = .updates
                    }
                }) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.8))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)

                if self.updatesCount > 0 {
                    Text("\(self.updatesCount)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(self.iceCyan))
                        .offset(x: 4, y: -2)
                }
            }

            // Profile Avatar Chip
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [self.mutedCyan, self.deepMutedTeal],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 28, height: 28)
                    .overlay(
                        Text("RU")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    )

                Circle()
                    .fill(self.sageGreen)
                    .frame(width: 7, height: 7)
                    .overlay(Circle().stroke(self.darkObsidian, lineWidth: 1.5))
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 40)
        .padding(.bottom, 12)
        .background(self.darkObsidian.opacity(0.75))
    }

    // ========================================================================
    // b) Platform Filter Sub-Header with Active Underline Indicator
    // ========================================================================
    private var platformFilterSubHeader: some View {
        HStack(spacing: 20) {
            ForEach(CoreHubPlatformFilter.allCases) { filter in
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        self.selectedPlatform = filter
                    }
                }) {
                    VStack(spacing: 6) {
                        Text(filter.rawValue)
                            .font(.system(size: 12, weight: self.selectedPlatform == filter ? .semibold : .regular))
                            .foregroundStyle(self.selectedPlatform == filter ? self.iceCyan : Color.white.opacity(0.65))

                        // Active Underline Indicator
                        Rectangle()
                            .fill(self.selectedPlatform == filter ? self.iceCyan : Color.clear)
                            .frame(height: 2)
                    }
                    .fixedSize(horizontal: true, vertical: false)
                }
                .buttonStyle(.plain)
            }

            Spacer()

            // Microkernel Metrics Chip
            HStack(spacing: 6) {
                Image(systemName: "cpu")
                    .font(.system(size: 10))
                    .foregroundStyle(self.iceCyan)
                Text("\(self.installedApps.count) Installed • \(self.availablePackages.count) Available • Two-Tier Sandbox")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.7))
            }
            .padding(.trailing, 8)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .background(self.darkSlate.opacity(0.75))
    }

    // ========================================================================
    // c) Left Category Sidebar
    // ========================================================================
    private var categorySidebar: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Section: Main Quick Links
                categoryButton(category: .allApps, count: self.categoryCount(for: .allApps))
                categoryButton(category: .updates, count: self.updatesCount > 0 ? self.updatesCount : nil, badgeColor: self.iceCyan)

                Divider()
                    .padding(.vertical, 8)

                // Section: Modular CoreBlow Categories
                Text("CATEGORIES")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.45))
                    .padding(.horizontal, 12)
                    .padding(.bottom, 4)

                categoryButton(category: .autonomousAgents, count: self.categoryCount(for: .autonomousAgents))
                categoryButton(category: .evoLoopSkills, count: self.categoryCount(for: .evoLoopSkills))
                categoryButton(category: .devTools, count: self.categoryCount(for: .devTools))
                categoryButton(category: .mcpBridges, count: self.categoryCount(for: .mcpBridges))
                categoryButton(category: .memoryWiki, count: self.categoryCount(for: .memoryWiki))

                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 12)
        }
    }

    private func categoryButton(category: CoreHubCategory, count: Int? = nil, badgeColor: Color? = nil) -> some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.15)) {
                self.selectedCategory = category
            }
        }) {
            HStack(spacing: 8) {
                Image(systemName: category.icon)
                    .font(.system(size: 12))
                    .foregroundStyle(self.selectedCategory == category ? self.iceCyan : Color.white.opacity(0.65))
                    .frame(width: 16)

                Text(category.rawValue)
                    .font(.system(size: 12, weight: self.selectedCategory == category ? .semibold : .regular))
                    .foregroundStyle(self.selectedCategory == category ? Color.white : Color.white.opacity(0.8))

                Spacer()

                if let count {
                    Text("\(count)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(badgeColor != nil ? Color.black : Color.white.opacity(0.7))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(badgeColor ?? Color.white.opacity(0.12))
                        )
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(self.selectedCategory == category ? self.mutedCyan.opacity(0.35) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }

    // ========================================================================
    // d) Central Canvas (Hero Banner + Installed + Available)
    // ========================================================================
    private var centralCanvas: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                // 1. Hero Banner
                heroBanner

                // Empty Search / Filter State
                if self.filteredInstalledApps.isEmpty && self.filteredAvailablePackages.isEmpty {
                    emptyFilterStateView
                } else {
                    // 2. Installed Section
                    if !self.filteredInstalledApps.isEmpty || self.selectedCategory == .allApps || self.selectedCategory == .updates {
                        installedSection
                    }

                    // 3. Available CoreHub Plugins & Skills Section
                    if !self.filteredAvailablePackages.isEmpty || self.selectedCategory == .allApps {
                        availablePackagesSection
                    }
                }
            }
            .padding(20)
        }
    }

    // 1. Hero Banner
    private var heroBanner: some View {
        ZStack(alignment: .leading) {
            // Deep Muted Teal to Dark Slate Gradient Background
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [self.deepMutedTeal, self.darkSlate],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            // Subtle Ice-Cyan Rim Highlight
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            self.iceCyan.opacity(0.45),
                            self.mutedCyan.opacity(0.2),
                            Color.clear
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )

            HStack(alignment: .center, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 14))
                            .foregroundStyle(self.iceCyan)

                        Text("COREHUB SOVEREIGN APP & PLUGIN MANAGER")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(self.iceCyan)
                    }

                    Text("Desktop Apps & 12-Service Microkernel Fleet")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)

                    Text("Manage native macOS/iOS/Android surfaces, Two-Tier extensible plugins (@coreblow/*), and autonomous SKILL.md V2 cognitive routines in one unified sovereign cockpit.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.white.opacity(0.8))
                        .lineLimit(2)

                    HStack(spacing: 8) {
                        heroPill(text: "Sovereign GA v2.0.0", icon: "checkmark.seal.fill")
                        heroPill(text: "12 Microkernel Services Active", icon: "cpu")
                        heroPill(text: "Two-Tier Sandbox: Enforced", icon: "lock.shield.fill")
                    }
                    .padding(.top, 4)
                }

                Spacer()

                // Decorative Holographic Emblem
                ZStack {
                    Circle()
                        .fill(self.mutedCyan.opacity(0.25))
                        .frame(width: 72, height: 72)
                        .blur(radius: 8)

                    Image(systemName: "square.grid.2x2.fill")
                        .font(.system(size: 34))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [self.iceCyan, self.mutedCyan],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
                .padding(.trailing, 10)
            }
            .padding(20)
        }
    }

    private func heroPill(text: String, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundStyle(self.iceCyan)
            Text(text)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.85))
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(self.darkObsidian.opacity(0.6))
                .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1))
        )
    }

    // Empty Filter State View
    private var emptyFilterStateView: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 32))
                .foregroundStyle(self.iceCyan.opacity(0.6))
                .padding(.top, 36)

            Text("No Matching Items Found")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)

            Text("No installed apps or community packages match '\(self.searchText.isEmpty ? self.selectedCategory.rawValue : self.searchText)' for platform '\(self.selectedPlatform.rawValue)'")
                .font(.system(size: 12))
                .foregroundStyle(Color.white.opacity(0.6))
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)

            Button(action: {
                withAnimation {
                    self.searchText = ""
                    self.selectedCategory = .allApps
                    self.selectedPlatform = .all
                    self.selectedTopTab = .apps
                }
            }) {
                Text("Reset Filters")
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .foregroundStyle(.white)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(self.mutedCyan)
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    // 2. Installed Section
    private var installedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("INSTALLED APPS & MICROKERNEL MODULES")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.85))

                Text("(\(self.filteredInstalledApps.count))")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(self.iceCyan)

                Spacer()

                Text("Auto-refresh active")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.45))
            }

            if self.filteredInstalledApps.isEmpty {
                Text(self.selectedCategory == .updates ? "All installed microkernel modules and apps are currently up to date." : "No installed apps match current filter criteria.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.5))
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 8) {
                    ForEach(self.filteredInstalledApps) { app in
                        installedAppRow(app: app)
                    }
                }
            }
        }
    }

    private func installedAppRow(app: CoreHubInstalledAppItem) -> some View {
        HStack(spacing: 14) {
            // App Icon
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(self.deepMutedTeal.opacity(0.8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(self.mutedCyan.opacity(0.35), lineWidth: 1)
                    )
                    .frame(width: 36, height: 36)

                Image(systemName: app.icon)
                    .font(.system(size: 16))
                    .foregroundStyle(self.iceCyan)
            }

            // Title & Description
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(app.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)

                    Text(app.version)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Color.white.opacity(0.5))
                }

                Text(app.description)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.65))
                    .lineLimit(1)
            }

            Spacer()

            // Status Dot + Text
            HStack(spacing: 6) {
                Circle()
                    .fill(app.isUpdateAvailable ? self.iceCyan : self.sageGreen)
                    .frame(width: 7, height: 7)

                Text(app.isUpdateAvailable ? "Update Available" : "Updated")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(app.isUpdateAvailable ? self.iceCyan : self.sageGreen)
            }
            .frame(width: 120, alignment: .leading)

            // Action Buttons
            if app.isUpdateAvailable {
                // Filled Muted Cyan "Update this app" Button
                Button(action: {
                    self.updateApp(id: app.id)
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 10))
                        Text("Update this app")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .foregroundStyle(.white)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(self.mutedCyan)
                    )
                }
                .buttonStyle(.plain)
            } else {
                // Outline "Open" Button
                Button(action: {
                    self.openApp(id: app.id)
                }) {
                    Text("Open")
                        .font(.system(size: 11, weight: .medium))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 5)
                        .foregroundStyle(Color.white.opacity(0.85))
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(Color.white.opacity(0.25), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }

            // Overflow Menu Button (•••)
            Menu {
                Button("View Details") {}
                Button("Inspect Manifest...") {}
                Divider()
                Button("Restart Service") {}
                Button("Rollback to Previous Version") {}
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.white.opacity(0.6))
                    .frame(width: 24, height: 24)
            }
            .menuStyle(.borderlessButton)
            .frame(width: 24)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(self.darkObsidian.opacity(0.55))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    // 3. Available CoreHub Plugins & Skills Section
    private var availablePackagesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("AVAILABLE COREHUB PLUGINS & SKILLS")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.85))

                    Text("TWO-TIER MODEL")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(self.iceCyan)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(self.deepMutedTeal))

                    Spacer()
                }

                Text("Official Tier A Plugins (@coreblow/*) run in sandboxed isolation. Community Tier B Skills (skill/*) are pure cognitive Markdown routines evaluated via Bayesian Wilson ranking.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.6))
            }

            if self.filteredAvailablePackages.isEmpty {
                Text("No available packages or skills match current filter criteria.")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.5))
                    .padding(.vertical, 8)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(self.filteredAvailablePackages) { pkg in
                        packageCard(pkg: pkg)
                    }
                }
            }
        }
    }

    private func packageCard(pkg: CoreHubPackageItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(self.deepMutedTeal.opacity(0.7))
                        .frame(width: 30, height: 30)

                    Image(systemName: pkg.icon)
                        .font(.system(size: 14))
                        .foregroundStyle(self.iceCyan)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(pkg.name)
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.white)
                        .lineLimit(1)

                    HStack(spacing: 4) {
                        // Tier Badge
                        Text(pkg.tierBadge)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(pkg.tierBadge.contains("Tier A") ? self.iceCyan : self.sageGreen)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(
                                Capsule()
                                    .fill(pkg.tierBadge.contains("Tier A") ? self.deepMutedTeal : self.darkObsidian)
                            )

                        // 🔒 Locked Badge
                        if pkg.isLocked {
                            HStack(spacing: 2) {
                                Image(systemName: "lock.fill")
                                    .font(.system(size: 8))
                                Text("Locked")
                                    .font(.system(size: 9, weight: .medium))
                            }
                            .foregroundStyle(self.iceCyan)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(self.mutedCyan.opacity(0.35)))
                        }

                        // Wilson Score Badge (Strict Ergonomic Ice-Cyan)
                        if let score = pkg.wilsonScore {
                            HStack(spacing: 2) {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 8))
                                    .foregroundStyle(self.iceCyan)
                                Text(String(format: "%.2f", score))
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(Color.white.opacity(0.1)))
                        }
                    }
                }

                Spacer()
            }

            Text(pkg.description)
                .font(.system(size: 11))
                .foregroundStyle(Color.white.opacity(0.7))
                .lineLimit(2)
                .frame(minHeight: 30, alignment: .topLeading)

            HStack {
                Spacer()

                if pkg.isInstalled {
                    Text("Installed")
                        .font(.system(size: 11, weight: .medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .foregroundStyle(Color.white.opacity(0.6))
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(Color.white.opacity(0.18), lineWidth: 1)
                        )
                } else if pkg.tierBadge.contains("Skill") {
                    Button(action: {
                        self.installPackage(id: pkg.id)
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.down.circle")
                                .font(.system(size: 10))
                            Text("Sync Skill")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .foregroundStyle(.white)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(self.mutedCyan.opacity(0.7))
                        )
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: {
                        self.installPackage(id: pkg.id)
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "plus.circle")
                                .font(.system(size: 10))
                            Text("Install")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .foregroundStyle(.white)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(self.mutedCyan)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(self.darkObsidian.opacity(0.55))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }
}
