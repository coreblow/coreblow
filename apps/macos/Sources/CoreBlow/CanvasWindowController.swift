import AppKit; import WebKit
class CanvasWindowController: NSWindowController {
    private(set) var webView: WKWebView?; let sessionId: String
    init(sessionId: String, canvasManager: CanvasManager) {
        self.sessionId = sessionId; let win = CanvasWindow(title: "Canvas: \(sessionId)", size: NSSize(width: 800, height: 600))
        super.init(window: win); setupWebView(canvasManager: canvasManager)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }
    private func setupWebView(canvasManager: CanvasManager) {
        let config = WKWebViewConfiguration(); config.setURLSchemeHandler(CanvasSchemeHandler(canvasManager: canvasManager), forURLScheme: CanvasScheme.scheme)
        let wv = WKWebView(frame: .zero, configuration: config); window?.contentView = wv; webView = wv
    }
    func navigate(to path: String) { if let url = CanvasScheme.url(session: sessionId, path: path) { webView?.load(URLRequest(url: url)) } }
    func evaluateJS(_ script: String) async throws -> Any? { try await webView?.evaluateJavaScript(script) }
}
