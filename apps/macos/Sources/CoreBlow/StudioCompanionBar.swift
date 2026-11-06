import AppKit
import Foundation
import Observation
import OSLog
import SwiftUI

private let companionLogger = Logger(subsystem: "ai.coreblow", category: "StudioCompanionBar")

public enum CompanionRouteTier: String, CaseIterable, Identifiable {
    case auto = "Auto"
    case coding = "Coding"
    case deep = "Deep"
    case local = "Local"

    public var id: String { self.rawValue }

    public var systemImage: String {
        switch self {
        case .auto: return "sparkles"
        case .coding: return "curlybraces"
        case .deep: return "brain.head.profile"
        case .local: return "shield.fill"
        }
    }
}

final class StudioCompanionPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

@MainActor
@Observable
public final class StudioCompanionBarController {
    public static let shared = StudioCompanionBarController()

    public var isVisible: Bool = false
    public var promptText: String = ""
    public var selectedTier: CompanionRouteTier = .auto
    public var frontmostAppName: String = "Xcode"
    public var isVoiceListening: Bool = false
    public var voiceRtfMetric: String = "RTF 0.28x"

    private var panel: StudioCompanionPanel?
    private var globalEventMonitor: Any?

    private init() {
        self.updateFrontmostApp()
    }

    public func updateFrontmostApp() {
        let frontApp = NSWorkspace.shared.frontmostApplication
        let myBundleId = Bundle.main.bundleIdentifier

        if let frontApp, frontApp.bundleIdentifier != myBundleId {
            self.frontmostAppName = frontApp.localizedName ?? "Desktop App"
        } else {
            // Find the most recent active non-CoreBlow app
            let running = NSWorkspace.shared.runningApplications.filter {
                $0.activationPolicy == .regular && $0.bundleIdentifier != myBundleId
            }
            if let target = running.first {
                self.frontmostAppName = target.localizedName ?? "Xcode"
            }
        }
    }

    public func show() {
        self.updateFrontmostApp()

        if self.panel == nil {
            self.createPanel()
        }

        guard let panel = self.panel else { return }

        // Center on active screen, positioned Spotlight-style
        if let screen = NSScreen.main {
            let screenRect = screen.visibleFrame
            let panelWidth: CGFloat = 680
            let panelHeight: CGFloat = 160
            let x = screenRect.origin.x + (screenRect.width - panelWidth) / 2
            let y = screenRect.origin.y + screenRect.height * 0.65 - panelHeight / 2
            panel.setFrame(NSRect(x: x, y: y, width: panelWidth, height: panelHeight), display: true)
        }

        panel.alphaValue = 0
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.15
            panel.animator().alphaValue = 1.0
        }

        self.isVisible = true
        self.installEscMonitor()
    }

    public func hide() {
        guard let panel = self.panel, self.isVisible else { return }
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.12
            panel.animator().alphaValue = 0.0
        }, completionHandler: {
            Task { @MainActor [weak self] in
                panel.orderOut(nil)
                self?.isVisible = false
            }
        })
        self.removeEscMonitor()
    }

    public func toggle() {
        if self.isVisible {
            self.hide()
        } else {
            self.show()
        }
    }

    public func openInStudio() {
        let prompt = self.promptText.trimmingCharacters(in: .whitespacesAndNewlines)
        self.hide()
        CoreBlowStudioWindowController.shared.show(initialPrompt: prompt.isEmpty ? nil : prompt)
        self.promptText = ""
    }

    private func createPanel() {
        let contentRect = NSRect(x: 0, y: 0, width: 680, height: 160)
        let panel = StudioCompanionPanel(
            contentRect: contentRect,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true

        let rootView = StudioCompanionBarView(controller: self)
        let hostingView = NSHostingView(rootView: rootView)
        hostingView.frame = contentRect
        hostingView.autoresizingMask = [.width, .height]

        let visualEffectView = NSVisualEffectView(frame: contentRect)
        visualEffectView.material = .hudWindow
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active
        visualEffectView.wantsLayer = true
        visualEffectView.layer?.cornerRadius = 20
        visualEffectView.layer?.masksToBounds = true
        visualEffectView.addSubview(hostingView)

        panel.contentView = visualEffectView
        self.panel = panel
    }

    private func installEscMonitor() {
        if self.globalEventMonitor == nil {
            self.globalEventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                if event.keyCode == 53 { // Escape
                    self?.hide()
                    return nil
                }
                return event
            }
        }
    }

    private func removeEscMonitor() {
        if let monitor = self.globalEventMonitor {
            NSEvent.removeMonitor(monitor)
            self.globalEventMonitor = nil
        }
    }
}

public struct StudioCompanionBarView: View {
    @Bindable var controller: StudioCompanionBarController
    @FocusState private var isInputFocused: Bool

    public init(controller: StudioCompanionBarController) {
        self.controller = controller
    }

    public var body: some View {
        VStack(spacing: 12) {
            // Header context chip row
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "sparkle.magnifyingglass")
                        .foregroundColor(.accentColor)
                        .font(.system(size: 13, weight: .semibold))
                    Text("CoreBlow Companion")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.primary)
                }

                Spacer()

                // Active paired app context chip
                HStack(spacing: 5) {
                    Image(systemName: "macwindow")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                    Text("Working with \(self.controller.frontmostAppName)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.primary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(Color(nsColor: .quaternaryLabelColor))
                )
                .overlay(
                    Capsule()
                        .strokeBorder(Color.accentColor.opacity(0.3), lineWidth: 1)
                )
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)

            // Main Prompt Field
            HStack {
                Image(systemName: "terminal")
                    .foregroundColor(.secondary)
                    .font(.system(size: 14))

                TextField(
                    "Ask Cory, generate code, or launch War Room session...",
                    text: self.$controller.promptText
                )
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .focused(self.$isInputFocused)
                .onSubmit {
                    self.controller.openInStudio()
                }

                if !self.controller.promptText.isEmpty {
                    Button(action: { self.controller.promptText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(nsColor: .textBackgroundColor).opacity(0.4))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 0.5)
            )
            .padding(.horizontal, 16)

            // Bottom control bar
            HStack(spacing: 12) {
                // Tier selector pills
                HStack(spacing: 4) {
                    ForEach(CompanionRouteTier.allCases) { tier in
                        Button(action: {
                            self.controller.selectedTier = tier
                        }) {
                            HStack(spacing: 4) {
                                Image(systemName: tier.systemImage)
                                    .font(.system(size: 10))
                                Text(tier.rawValue)
                                    .font(.system(size: 11, weight: .medium))
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(self.controller.selectedTier == tier ? Color.accentColor : Color.clear)
                            )
                            .foregroundStyle(self.controller.selectedTier == tier ? .white : .secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color(nsColor: .quaternaryLabelColor))
                )

                Spacer()

                // Apple Silicon MLX Voice button (RTF <= 0.4)
                Button(action: {
                    self.controller.isVoiceListening.toggle()
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: self.controller.isVoiceListening ? "waveform.badge.mic" : "mic.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(self.controller.isVoiceListening ? .red : .accentColor)
                        Text(self.controller.voiceRtfMetric)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule()
                            .fill(Color(nsColor: .quaternaryLabelColor))
                    )
                }
                .buttonStyle(.plain)

                // Open in CoreBlow Studio button (Cmd+Return)
                Button(action: {
                    self.controller.openInStudio()
                }) {
                    HStack(spacing: 5) {
                        Text("Open in Studio")
                            .font(.system(size: 12, weight: .semibold))
                        Text("⌘↩")
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(Color.white.opacity(0.2))
                            )
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color.accentColor)
                    )
                    .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.return, modifiers: .command)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
        }
        .frame(width: 680, height: 160)
        .onAppear {
            self.isInputFocused = true
        }
    }
}
