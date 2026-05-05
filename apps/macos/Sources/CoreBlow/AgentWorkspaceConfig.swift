import Foundation
struct AgentWorkspaceConfig: Codable { var workspaces: [AgentWorkspace] = []; static func load() -> AgentWorkspaceConfig { guard let data = try? Data(contentsOf: CoreBlowPaths.applicationSupport.appendingPathComponent("workspaces.json")) else { return AgentWorkspaceConfig() }; return (try? JSONDecoder().decode(AgentWorkspaceConfig.self, from: data)) ?? AgentWorkspaceConfig() } }
