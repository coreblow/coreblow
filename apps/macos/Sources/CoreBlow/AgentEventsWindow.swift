import AppKit; import SwiftUI
enum AgentEventsWindow { private static var window: NSWindow?; static func show(store: AgentEventStore) { let w = NSWindow(contentRect: NSRect(x:0,y:0,width:500,height:400), styleMask:[.titled,.closable,.resizable], backing:.buffered, defer:false); w.title = "Agent Events"; w.center(); w.makeKeyAndOrderFront(nil); window = w } }
