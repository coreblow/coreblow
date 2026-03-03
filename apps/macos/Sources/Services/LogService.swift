import Foundation

class LogService {
    static let shared = LogService()
    private init() {}

    func start() async throws {}
    func stop() {}
}
