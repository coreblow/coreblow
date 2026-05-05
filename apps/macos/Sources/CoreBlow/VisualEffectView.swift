import SwiftUI
struct VisualEffectView: NSViewRepresentable { let material: NSVisualEffectView.Material; let blendingMode: NSVisualEffectView.BlendingMode
    func makeNSView(context: Context) -> NSVisualEffectView { let v = NSVisualEffectView(); v.material = material; v.blendingMode = blendingMode; v.state = .active; return v }
    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {}
}
