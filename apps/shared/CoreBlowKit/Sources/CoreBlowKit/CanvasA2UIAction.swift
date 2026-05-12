import Foundation

/// CoreBlow: Original implementation of Canvas A2UI Actions
/// 1. Pattern borrowed: Defining structures for actions dispatched by the AI agent to interact with UI components (e.g., rendering charts, showing modals).
/// 2. Implemented differently: Uses `CoreBlowCanvasAction` leveraging Swift `Codable` enumerations with associated values where applicable, replacing purely dictionary-based typings.
/// Ensures rigorous type safety when parsing complex visual operations.

// MARK: - Action Declarations

public enum CoreBlowCanvasAction: Codable, Sendable, Equatable {

    /// Action requesting a visual chart update.
    case renderChart(ChartPayload)

    /// Action requesting the display of an interactive modal.
    case displayModal(ModalPayload)

    /// Action instructing the client to refresh the underlying data view.
    case refreshDataView

    /// Fallback for unrecognized UI operations to prevent decoding crashes.
    case unknown(operation: String)

    // MARK: - Coding Keys

    private enum CodingKeys: String, CodingKey {
        case operation
        case payload
    }

    // MARK: - Manual Decodable Implementation

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let operation = try container.decode(String.self, forKey: .operation)

        switch operation {
        case "render_chart":
            let payload = try container.decode(ChartPayload.self, forKey: .payload)
            self = .renderChart(payload)
        case "display_modal":
            let payload = try container.decode(ModalPayload.self, forKey: .payload)
            self = .displayModal(payload)
        case "refresh_data":
            self = .refreshDataView
        default:
            self = .unknown(operation: operation)
        }
    }

    // MARK: - Manual Encodable Implementation

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .renderChart(let payload):
            try container.encode("render_chart", forKey: .operation)
            try container.encode(payload, forKey: .payload)
        case .displayModal(let payload):
            try container.encode("display_modal", forKey: .operation)
            try container.encode(payload, forKey: .payload)
        case .refreshDataView:
            try container.encode("refresh_data", forKey: .operation)
        case .unknown(let operation):
            try container.encode(operation, forKey: .operation)
        }
    }
}

// MARK: - Payload Structures

public struct ChartPayload: Codable, Sendable, Equatable {
    public let title: String
    public let dataPoints: [Double]
    public let axisLabels: [String]

    public init(title: String, dataPoints: [Double], axisLabels: [String]) {
        self.title = title
        self.dataPoints = dataPoints
        self.axisLabels = axisLabels
    }
}

public struct ModalPayload: Codable, Sendable, Equatable {
    public let title: String
    public let body: String
    public let confirmLabel: String?

    public init(title: String, body: String, confirmLabel: String? = nil) {
        self.title = title
        self.body = body
        self.confirmLabel = confirmLabel
    }
}
