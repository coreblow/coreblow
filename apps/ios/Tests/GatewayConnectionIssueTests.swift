import Testing
@testable import CoreBlow

@Suite("GatewayConnectionIssue")
struct GatewayConnectionIssueTests {
    @Test func issueDescriptionIsNotEmpty() {
        let issue = GatewayConnectionIssue(code: .authFailed, message: "bad token")
        #expect(!issue.message.isEmpty)
        #expect(issue.code == .authFailed)
    }

    @Test func timeoutIssueHasCorrectCode() {
        let issue = GatewayConnectionIssue(code: .timeout, message: "timed out")
        #expect(issue.code == .timeout)
    }
}
