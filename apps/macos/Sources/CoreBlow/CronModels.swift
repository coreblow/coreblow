import Foundation
struct CronJob: Identifiable, Codable { let id: String; var name: String; var schedule: String; var command: String; var enabled: Bool; var lastRun: Date?; var nextRun: Date? }
