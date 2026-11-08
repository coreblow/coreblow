import AppKit
import Foundation
import Observation
import OSLog
import SwiftUI

private let studioWindowLogger = Logger(subsystem: "ai.coreblow", category: "CoreBlowStudioWindow")

@MainActor
@Observable
public final class CoreBlowStudioWindowController: NSWindowController, NSWindowDelegate {
    public static let shared = CoreBlowStudioWindowController()

    private var studioWindow: NSWindow?

    private init() {
        super.init(window: nil)
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    public func show(initialPrompt: String? = nil) {
        if self.studioWindow == nil {
            self.createStudioWindow(initialPrompt: initialPrompt)
        } else if let initialPrompt, !initialPrompt.isEmpty {
            // Re-create or pass initialPrompt
            self.createStudioWindow(initialPrompt: initialPrompt)
        }

        guard let window = self.studioWindow else { return }

        NSApp.setActivationPolicy(.regular)
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        DockIconManager.shared.updateDockVisibility()
        studioWindowLogger.info("CoreBlow Studio window shown")
    }

    private func createStudioWindow(initialPrompt: String? = nil) {
        let contentRect = NSRect(x: 0, y: 0, width: 1024, height: 638)
        let window = NSWindow(
            contentRect: contentRect,
            styleMask: [
                .titled,
                .closable,
                .miniaturizable,
                .resizable,
                .fullSizeContentView,
            ],
            backing: .buffered,
            defer: false
        )

        window.minSize = NSSize(width: 860, height: 540)
        window.isOpaque = true
        window.backgroundColor = NSColor(red: 9/255.0, green: 17/255.0, blue: 15/255.0, alpha: 1.0)
        window.title = "CoreBlow Studio"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.center()

        let studioView = CoreBlowStudioView(initialPrompt: initialPrompt)
        let hostingController = NSHostingController(rootView: studioView)
        window.contentViewController = hostingController

        self.studioWindow = window
        self.window = window
    }

    public func windowWillClose(_ notification: Notification) {
        studioWindowLogger.info("CoreBlow Studio window closed")
    }
}
