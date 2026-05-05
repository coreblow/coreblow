import Foundation; import WebKit
class CanvasA2UIActionMessageHandler: NSObject, WKScriptMessageHandler {
    var onAction: ((String) -> Void)?
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? String { onAction?(body) }
    }
}
