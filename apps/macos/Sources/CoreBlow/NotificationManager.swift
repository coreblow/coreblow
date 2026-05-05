import Foundation; import UserNotifications
@MainActor final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    func requestPermission() async -> Bool { try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) ?? false }
    func post(title: String, body: String, sound: String?) async { let content = UNMutableNotificationContent(); content.title = title; content.body = body; if sound != nil { content.sound = .default }; let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil); try? await UNUserNotificationCenter.current().add(req) }
}
