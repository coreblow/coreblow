import SwiftUI
import WidgetKit

struct MemoryWidget: Widget {
    let kind = "MemoryWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SimpleProvider()) { entry in
            Text("MemoryWidget")
        }
        .configurationDisplayName("MemoryWidget")
    }
}

struct SimpleProvider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry { SimpleEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) { completion(SimpleEntry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        completion(Timeline(entries: [SimpleEntry(date: Date())], policy: .atEnd))
    }
}

struct SimpleEntry: TimelineEntry { let date: Date }
