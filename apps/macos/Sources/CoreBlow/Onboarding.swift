import Foundation
enum OnboardingState {
    private static let key = "coreblow.onboarding.completed"
    static var isCompleted: Bool { UserDefaults.standard.bool(forKey: key) }
    static func markCompleted() { UserDefaults.standard.set(true, forKey: key) }
    static func reset() { UserDefaults.standard.removeObject(forKey: key) }
}
