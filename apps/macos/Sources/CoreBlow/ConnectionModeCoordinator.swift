import Foundation; import Observation
@MainActor @Observable final class ConnectionModeCoordinator { enum Mode { case local, remote, tailscale }; var currentMode: Mode = .local }
