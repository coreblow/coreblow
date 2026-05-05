import Foundation
struct ModelCatalogEntry: Codable, Identifiable { let id: String; let name: String; let provider: String; let contextWindow: Int? }
enum ModelCatalogLoader { static func load(from gatewayURL: URL) async -> [ModelCatalogEntry] { guard let url = URL(string: "\(gatewayURL)/api/models") else { return [] }; do { let (data, _) = try await URLSession.shared.data(from: url); return (try? JSONDecoder().decode([ModelCatalogEntry].self, from: data)) ?? [] } catch { return [] } } }
