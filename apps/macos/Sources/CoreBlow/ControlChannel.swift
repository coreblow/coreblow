import Foundation
actor ControlChannel {
    private var connection: FileHandle?
    func connect(socketPath: String) throws { let url = URL(fileURLWithPath: socketPath); connection = try FileHandle(forReadingFrom: url) }
    func send(_ request: Request) async throws -> Response { let data = try JSONEncoder().encode(request); connection?.write(data); return Response(ok: true) }
    func disconnect() { try? connection?.close(); connection = nil }
}
