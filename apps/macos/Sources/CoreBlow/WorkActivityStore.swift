import Foundation; import Observation
@MainActor @Observable final class WorkActivityStore { struct Activity: Identifiable { let id = UUID(); let type: String; let description: String; let timestamp: Date }; var activities: [Activity] = []; func log(type: String, description: String) { activities.append(Activity(type: type, description: description, timestamp: Date())) } }
