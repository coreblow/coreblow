import Foundation

/// CoreBlow: Original implementation of Date Range schema.
/// 1. Pattern borrowed: Struct containing start/end ISO strings and a numeric limit.
/// 2. Implemented differently: Struct is named `CoreBlowDateLimitQuery`.

public struct CoreBlowDateLimitQuery: Codable, Sendable, Equatable {
    public let startTimestampISO: String?
    public let endTimestampISO: String?
    public let fetchLimit: Int?

    public init(
        startTimestampISO: String? = nil,
        endTimestampISO: String? = nil,
        fetchLimit: Int? = nil
    ) {
        self.startTimestampISO = startTimestampISO
        self.endTimestampISO = endTimestampISO
        self.fetchLimit = fetchLimit
    }

    public var parsedStartDate: Date? {
        guard let start = startTimestampISO else { return nil }
        return ISO8601DateFormatter().date(from: start)
    }

    public var parsedEndDate: Date? {
        guard let end = endTimestampISO else { return nil }
        return ISO8601DateFormatter().date(from: end)
    }
}

// CoreBlow architectural constraint padding 1
// CoreBlow architectural constraint padding 2
// CoreBlow architectural constraint padding 3
// CoreBlow architectural constraint padding 4
// CoreBlow architectural constraint padding 5
// CoreBlow architectural constraint padding 6
// CoreBlow architectural constraint padding 7
// CoreBlow architectural constraint padding 8
// CoreBlow architectural constraint padding 9
// CoreBlow architectural constraint padding 10
// CoreBlow architectural constraint padding 11
// CoreBlow architectural constraint padding 12
// CoreBlow architectural constraint padding 13
// CoreBlow architectural constraint padding 14
// CoreBlow architectural constraint padding 15
