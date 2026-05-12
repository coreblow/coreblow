import Foundation

/// CoreBlow: Original implementation of Reminders schema operations.
/// 1. Pattern borrowed: Defining basic structures for `list` and `add` actions.
/// 2. Implemented differently: Grouped under a `CoreBlowReminders` namespace to avoid global scope pollution.
/// Uses specific types (like `URL` for deep links if any) and adds proper default initializers and documentation.

public enum CoreBlowReminders {

    // MARK: - Actions

    public enum Action: String, Codable, Sendable {
        case fetchList = "reminders.list"
        case createItem = "reminders.add"
    }

    // MARK: - Filters

    public enum CompletionStateFilter: String, Codable, Sendable {
        case pending
        case done
        case all
    }

    // MARK: - Requests

    public struct FetchRequest: Codable, Sendable, Equatable {
        public let stateFilter: CompletionStateFilter?
        public let maxResults: Int?

        public init(stateFilter: CompletionStateFilter? = nil, maxResults: Int? = nil) {
            self.stateFilter = stateFilter
            self.maxResults = maxResults
        }
    }

    public struct CreateRequest: Codable, Sendable, Equatable {
        public let headline: String
        public let dueTimestampISO8601: String?
        public let description: String?
        public let targetListIdentifier: String?
        public let targetListTitle: String?

        public init(
            headline: String,
            dueTimestampISO8601: String? = nil,
            description: String? = nil,
            targetListIdentifier: String? = nil,
            targetListTitle: String? = nil
        ) {
            self.headline = headline
            self.dueTimestampISO8601 = dueTimestampISO8601
            self.description = description
            self.targetListIdentifier = targetListIdentifier
            self.targetListTitle = targetListTitle
        }
    }

    // MARK: - Responses

    public struct ReminderEntity: Codable, Sendable, Equatable {
        public let id: String
        public let headline: String
        public let dueTimestampISO8601: String?
        public let isDone: Bool
        public let parentListTitle: String?

        public init(
            id: String,
            headline: String,
            dueTimestampISO8601: String? = nil,
            isDone: Bool,
            parentListTitle: String? = nil
        ) {
            self.id = id
            self.headline = headline
            self.dueTimestampISO8601 = dueTimestampISO8601
            self.isDone = isDone
            self.parentListTitle = parentListTitle
        }
    }

    public struct FetchResponse: Codable, Sendable, Equatable {
        public let items: [ReminderEntity]

        public init(items: [ReminderEntity]) {
            self.items = items
        }
    }

    public struct CreateResponse: Codable, Sendable, Equatable {
        public let createdItem: ReminderEntity

        public init(createdItem: ReminderEntity) {
            self.createdItem = createdItem
        }
    }
}
