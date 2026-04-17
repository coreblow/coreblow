import SwiftUI
import WidgetKit

struct TokenWidget: Widget {
    let kind = "TokenWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SimpleProvider()) { entry in
            Text("TokenWidget")
        }
        .configurationDisplayName("TokenWidget")
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
