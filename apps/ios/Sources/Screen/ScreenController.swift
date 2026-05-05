import Foundation
import Observation
#if canImport(UIKit)
import UIKit
import WebKit
#endif

/// Controls the canvas WebView and handles navigation, JS evaluation, and deep links.
@MainActor
@Observable
final class ScreenController {

    var currentURL: String?
    var isLoading: Bool = false
    var canGoBack: Bool = false
    var canGoForward: Bool = false
    var pageTitle: String?

    var onDeepLink: ((URL) -> Void)?
    var onA2UIAction: (([String: Any]) -> Void)?

    #if canImport(UIKit)
    private(set) var webView: WKWebView?
    #endif

    func configure() {
        #if canImport(UIKit)
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.allowsBackForwardNavigationGestures = true
        webView = wv
        #endif
    }

    func navigate(to urlString: String) {
        guard let url = URL(string: urlString) else { return }
        currentURL = urlString
        #if canImport(UIKit)
        webView?.load(URLRequest(url: url))
        #endif
    }

    func reload() {
        #if canImport(UIKit)
        webView?.reload()
        #endif
    }

    func goBack() {
        #if canImport(UIKit)
        webView?.goBack()
        #endif
    }

    func goForward() {
        #if canImport(UIKit)
        webView?.goForward()
        #endif
    }

    func eval(javaScript: String) async throws -> Any? {
        #if canImport(UIKit)
        return try await webView?.evaluateJavaScript(javaScript)
        #else
        return nil
        #endif
    }

    func showDefaultCanvas() {
        currentURL = nil
        pageTitle = "Home"
        #if canImport(UIKit)
        let html = "<html><body style='background:#111;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh'><h1>CoreBlow</h1></body></html>"
        webView?.loadHTMLString(html, baseURL: nil)
        #endif
    }

    func waitForA2UIReady(timeoutMs: Int = 5000) async -> Bool {
        let start = Date()
        while Date().timeIntervalSince(start) * 1000 < Double(timeoutMs) {
            if let result = try? await eval(javaScript: "window.__coreblow_a2ui_ready === true"),
               let ready = result as? Bool, ready {
                return true
            }
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        return false
    }
}
