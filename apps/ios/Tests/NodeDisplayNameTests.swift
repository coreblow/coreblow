import Testing
import UIKit
@testable import CoreBlow

@Suite("NodeDisplayName")
struct NodeDisplayNameTests {
    @Test func genericNamesAreDetected() {
        #expect(NodeDisplayName.isGeneric("iPhone Node"))
        #expect(NodeDisplayName.isGeneric("iPad Node"))
        #expect(NodeDisplayName.isGeneric("CoreBlow Node"))
        #expect(!NodeDisplayName.isGeneric("My Custom Name"))
    }

    @Test @MainActor func resolvePrefersSavedName() {
        let result = NodeDisplayName.resolve(existing: "Custom", deviceName: "iPhone", interfaceIdiom: .phone)
        #expect(result == "Custom")
    }

    @Test @MainActor func resolveSkipsGenericName() {
        let result = NodeDisplayName.resolve(existing: "iPhone Node", deviceName: "John's iPhone", interfaceIdiom: .phone)
        #expect(result == "John's iPhone")
    }
}
