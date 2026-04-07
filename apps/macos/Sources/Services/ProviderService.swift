import Foundation

class ProviderService {
    static let shared = ProviderService()
    private init() {}

    func start() async throws {}
    func stop() {}
}
