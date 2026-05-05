import SwiftUI
#if canImport(UIKit)
import UIKit
import WebKit
#endif

/// UIViewRepresentable wrapper for WKWebView used in the canvas/screen tab.
struct ScreenWebView: UIViewRepresentable {
    let controller: ScreenController

    #if canImport(UIKit)
    func makeUIView(context: Context) -> WKWebView {
        if controller.webView == nil {
            controller.configure()
        }
        let wv = controller.webView ?? WKWebView()
        wv.navigationDelegate = context.coordinator
        return wv
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // State is driven by ScreenController
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller)
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let controller: ScreenController

        init(controller: ScreenController) {
            self.controller = controller
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            controller.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            controller.isLoading = false
            controller.canGoBack = webView.canGoBack
            controller.canGoForward = webView.canGoForward
            controller.pageTitle = webView.title
            controller.currentURL = webView.url?.absoluteString
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            controller.isLoading = false
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if let url = navigationAction.request.url,
               url.scheme == "coreblow" {
                controller.onDeepLink?(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
    #endif
}
