import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() throws {
        let tmp = try makeTempDirForTests()
        CommandResolver.setProjectRoot(tmp.path)

        let coreblowPath = tmp.appendingPathComponent("node_modules/.bin/coreblow")
        try makeExecutableForTests(at: coreblowPath)

        let start = NodeServiceManager._testServiceCommand(["start"])
        #expect(start == [coreblowPath.path, "node", "start", "--json"])

        let stop = NodeServiceManager._testServiceCommand(["stop"])
        #expect(stop == [coreblowPath.path, "node", "stop", "--json"])
    }
}
