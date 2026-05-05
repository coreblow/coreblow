import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct AppStateRemoteConfigTests {
    @Test func `applies remote config values`() async {
        await MainActor.run {
            let state = AppStateStore.shared
            let previous = state.gatewayAutostart
            state.applyRemoteConfig(["gateway.autostart": true])
            #expect(state.gatewayAutostart == true)
            state.applyRemoteConfig(["gateway.autostart": previous])
        }
    }

    @Test func `ignores unknown remote config keys`() async {
        await MainActor.run {
            let state = AppStateStore.shared
            let previousAutostart = state.gatewayAutostart
            state.applyRemoteConfig(["unknown.key.xyz": "value"])
            #expect(state.gatewayAutostart == previousAutostart)
        }
    }

    @Test func `applies voice wake triggers from remote`() async {
        await MainActor.run {
            let state = AppStateStore.shared
            let previous = state.swabbleTriggerWords
            state.applyRemoteConfig(["voicewake.triggers": ["hey", "computer"]])
            #expect(state.swabbleTriggerWords == ["hey", "computer"])
            state.applyRemoteConfig(["voicewake.triggers": previous])
        }
    }

    @Test func `type mismatch in remote config is ignored`() async {
        await MainActor.run {
            let state = AppStateStore.shared
            let previous = state.gatewayAutostart
            state.applyRemoteConfig(["gateway.autostart": "not-a-bool"])
            #expect(state.gatewayAutostart == previous)
        }
    }
}
