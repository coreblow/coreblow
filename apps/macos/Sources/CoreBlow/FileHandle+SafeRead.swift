import Foundation
extension FileHandle { func safeReadToEnd() -> Data? { try? availableData } }
