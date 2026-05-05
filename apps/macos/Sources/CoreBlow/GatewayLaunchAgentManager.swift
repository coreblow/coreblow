import Foundation
enum GatewayLaunchAgentManager { static func ensureRunning() { if !LaunchAgentManager.isInstalled() { try? LaunchAgentManager.install(binaryPath: RuntimeLocator.locateGatewayBinary()?.path ?? "", port: Constants.defaultGatewayPort) } } }
