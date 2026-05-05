import Foundation; import Observation
@MainActor @Observable final class NodesStore { var nodes: [NodeServiceManager.NodeInfo] = [] }
