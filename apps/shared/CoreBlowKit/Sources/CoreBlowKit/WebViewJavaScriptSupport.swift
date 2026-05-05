import Foundation
public enum WebViewJavaScriptSupport {
    public static func injectConsoleCapture() -> String { "window.__cb_console = []; ['log','warn','error'].forEach(m => { const orig = console[m]; console[m] = (...args) => { window.__cb_console.push({level:m,args:args.map(String)}); orig.apply(console, args); }; });" }
    public static func readCapturedConsole() -> String { "JSON.stringify(window.__cb_console || [])" }
}
