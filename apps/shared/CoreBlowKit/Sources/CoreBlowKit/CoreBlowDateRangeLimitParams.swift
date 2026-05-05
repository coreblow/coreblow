import Foundation
public struct CoreBlowDateRangeLimitParams: Codable, Sendable {
    public let start: Date?; public let end: Date?; public let maxResults: Int?
    public init(start: Date? = nil, end: Date? = nil, maxResults: Int? = nil) { self.start = start; self.end = end; self.maxResults = maxResults }
    public func effectiveRange() -> (start: Date, end: Date) { (start ?? Calendar.current.date(byAdding: .day, value: -7, to: Date())!, end ?? Date()) }
}
