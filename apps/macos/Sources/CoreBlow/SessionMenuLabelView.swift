import SwiftUI
import OSLog
import CoreBlowKit
import OSLog

extension EnvironmentValues {
    @Entry var menuItemHighlighted: Bool = false
}

struct SessionMenuLabelView: View {
    let row: SessionRow
    let width: CGFloat
    @Environment(\.menuItemHighlighted) private var isHighlighted
    private let paddingLeading: CGFloat = 22
    private let paddingTrailing: CGFloat = 14
    private let barHeight: CGFloat = 6

    init(row: SessionRow, width: CGFloat) {
        self.row = row
        self.width = width
    }

    init(session: SessionData) {
        let key = session.sessionKey ?? session.id
        self.row = SessionRow(
            id: session.id,
            key: key,
            kind: SessionKind.from(key: key),
            displayName: session.displayName ?? session.name,
            provider: nil,
            subject: nil,
            room: nil,
            space: nil,
            updatedAt: session.updatedAt,
            sessionId: session.id,
            thinkingLevel: nil,
            verboseLevel: nil,
            systemSent: false,
            abortedLastRun: false,
            tokens: SessionTokenStats(input: 0, output: 0, total: 0, contextTokens: 1),
            model: session.model)
        self.width = 300
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ContextUsageBar(
                usedTokens: self.row.tokens.total,
                contextTokens: self.row.tokens.contextTokens,
                width: max(1, self.width - (self.paddingLeading + self.paddingTrailing)),
                height: self.barHeight)

            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(self.row.label)
                    .font(.caption.weight(self.row.key == "main" ? .semibold : .regular))
                    .foregroundStyle(MenuItemHighlightColors.primary(self.isHighlighted))
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .layoutPriority(1)

                Spacer(minLength: 4)

                Text("\(self.row.tokens.contextSummaryShort) · \(self.row.ageText)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(MenuItemHighlightColors.secondary(self.isHighlighted))
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(2)

                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MenuItemHighlightColors.secondary(self.isHighlighted))
                    .padding(.leading, 2)
            }
        }
        .padding(.vertical, 10)
        .padding(.leading, self.paddingLeading)
        .padding(.trailing, self.paddingTrailing)
    }
}
