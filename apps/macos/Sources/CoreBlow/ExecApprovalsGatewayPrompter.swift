import Foundation
actor ExecApprovalsGatewayPrompter {
    func sendApprovalResult(gatewayURL: URL, approvalId: String, approved: Bool) async throws {
        var req = URLRequest(url: gatewayURL.appendingPathComponent("/api/approvals/\(approvalId)"))
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["approved": approved])
        _ = try await URLSession.shared.data(for: req)
    }
}
