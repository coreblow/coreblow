import Foundation; import Observation
@MainActor @Observable final class MacNodeModeCoordinator {
    private(set) var isNodeMode = false; private var runtime: MacNodeRuntime?
    func enable() { runtime = MacNodeRuntime(); runtime?.start(); isNodeMode = true }
    func disable() { runtime?.stop(); runtime = nil; isNodeMode = false }
}
