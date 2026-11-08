import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    self.contentViewController = flutterViewController

    // Unified custom obsidian titlebar & exact 1024x638 proportions
    self.titleVisibility = .hidden
    self.titlebarAppearsTransparent = true
    self.styleMask.insert(.fullSizeContentView)
    self.isOpaque = true
    self.backgroundColor = NSColor(red: 9/255.0, green: 17/255.0, blue: 15/255.0, alpha: 1.0)
    self.setContentSize(NSSize(width: 1024, height: 638))
    self.minSize = NSSize(width: 860, height: 540)
    self.center()

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }
}
