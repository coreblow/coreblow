import Foundation

public enum CanvasCommands: Sendable {
    public enum Action: String, Codable, Sendable {
        case present = "canvas.present"
        case hide = "canvas.hide"
        case navigate = "canvas.navigate"
        case eval = "canvas.eval"
        case snapshot = "canvas.snapshot"
    }
}
