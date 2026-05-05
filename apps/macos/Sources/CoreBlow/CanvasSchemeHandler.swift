import Foundation; import WebKit
class CanvasSchemeHandler: NSObject, WKURLSchemeHandler {
    private let canvasManager: CanvasManager
    init(canvasManager: CanvasManager) { self.canvasManager = canvasManager }
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, let session = CanvasScheme.extractSession(url) else {
            urlSchemeTask.didFailWithError(URLError(.badURL)); return }
        let path = CanvasScheme.extractPath(url)
        let dir = CoreBlowPaths.canvasDirectory.appendingPathComponent(session)
        let fileURL = dir.appendingPathComponent(path == "/" ? "index.html" : path)
        guard let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist)); return }
        let mime = mimeType(for: fileURL.pathExtension)
        let response = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: nil)
        urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
    private func mimeType(for ext: String) -> String {
        switch ext.lowercased() { case "html": "text/html"; case "css": "text/css"; case "js": "application/javascript"
        case "json": "application/json"; case "png": "image/png"; case "jpg","jpeg": "image/jpeg"; case "svg": "image/svg+xml"
        default: "application/octet-stream" }
    }
}
