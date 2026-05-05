import Testing
@testable import CoreBlow

struct ExecApprovalsSocketAuthTests {
    @Test func `token validation accepts matching token`() {
        let token = ExecApprovalsSocketAuth.generateToken()
        #expect(!token.isEmpty)
        #expect(ExecApprovalsSocketAuth.validate(token: token, expected: token))
    }

    @Test func `token validation rejects mismatched token`() {
        let token1 = ExecApprovalsSocketAuth.generateToken()
        let token2 = ExecApprovalsSocketAuth.generateToken()
        #expect(!ExecApprovalsSocketAuth.validate(token: token1, expected: token2))
    }

    @Test func `generated tokens are unique`() {
        let tokens = (0..<10).map { _ in ExecApprovalsSocketAuth.generateToken() }
        #expect(Set(tokens).count == tokens.count)
    }
}
