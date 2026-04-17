import SwiftUI
import WidgetKit

struct ChatWidget: Widget {
    let kind = "ChatWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: IOSProvider()) { _ in Text("ChatWidget") }
    }
}
struct IOSProvider: TimelineProvider {
    func placeholder(in c: Context) -> IOSEntry { IOSEntry(date: Date()) }
    func getSnapshot(in c: Context, completion: @escaping (IOSEntry) -> Void) { completion(IOSEntry(date: Date())) }
    func getTimeline(in c: Context, completion: @escaping (Timeline<IOSEntry>) -> Void) { completion(Timeline(entries: [IOSEntry(date: Date())], policy: .atEnd)) }
}
struct IOSEntry: TimelineEntry { let date: Date }
