import AppKit
extension NSColor { convenience init(hex: String) { var h = hex.trimmingCharacters(in: .alphanumerics.inverted); if h.count == 6 { h += "FF" }; var i: UInt64 = 0; Scanner(string: h).scanHexInt64(&i); self.init(red: CGFloat((i>>24)&0xFF)/255, green: CGFloat((i>>16)&0xFF)/255, blue: CGFloat((i>>8)&0xFF)/255, alpha: CGFloat(i&0xFF)/255) } }
