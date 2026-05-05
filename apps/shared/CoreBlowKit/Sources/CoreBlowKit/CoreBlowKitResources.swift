import Foundation
public enum CoreBlowKitResources { public static var scaffoldHTML: String { (try? String(contentsOf: Bundle.module.url(forResource: "scaffold", withExtension: "html", subdirectory: "CanvasScaffold")!)) ?? "<html><body>CoreBlow Canvas</body></html>" } }
