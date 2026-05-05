import Foundation
import Testing
@testable import CoreBlow

@Suite("OnboardingStateStore")
struct OnboardingStateStoreTests {
    @Test func initialStateIsNotCompleted() {
        OnboardingStateStore.reset()
        #expect(!OnboardingStateStore.isCompleted)
        #expect(OnboardingStateStore.lastMode == nil)
    }

    @Test func markCompletedPersists() {
        OnboardingStateStore.reset()
        OnboardingStateStore.markCompleted(mode: .scan)
        #expect(OnboardingStateStore.isCompleted)
        #expect(OnboardingStateStore.lastMode == .scan)
    }

    @Test func resetClearsState() {
        OnboardingStateStore.markCompleted(mode: .manual)
        OnboardingStateStore.reset()
        #expect(!OnboardingStateStore.isCompleted)
        #expect(OnboardingStateStore.lastMode == nil)
    }
}
