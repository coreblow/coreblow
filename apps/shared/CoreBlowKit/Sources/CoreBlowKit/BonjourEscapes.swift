import Foundation
public enum BonjourEscapes {
    public static func escapeName(_ name: String) -> String { name.replacingOccurrences(of: ".", with: "\\.").replacingOccurrences(of: " ", with: "\\ ") }
    public static func unescapeName(_ name: String) -> String { name.replacingOccurrences(of: "\\.", with: ".").replacingOccurrences(of: "\\ ", with: " ") }
}
