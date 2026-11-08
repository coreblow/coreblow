//
// CoreBlow — Mobile War Room Monitor & Kanban DAG Viewer (Tab 2)
//
// Native iOS DAG monitor showing active subagent tasks across
// Backlog, In Progress, Review, and Done with subagent role badges.
//

import SwiftUI

struct MobileKanbanCardItem: Identifiable, Hashable {
    let id: String
    let title: String
    let role: String // "lead" | "coder" | "auditor" | "verifier"
    let column: String // "Backlog" | "In Progress" | "Review" | "Done"
    let duration: String
    let agentInitials: String
}

struct WarRoomMonitorTab: View {
    @State private var selectedColumn: String = "In Progress"
    @State private var cards: [MobileKanbanCardItem] = [
        MobileKanbanCardItem(
            id: "card_1",
            title: "Coordinate Stage 15 multi-surface parity across iOS, Android, and Windows",
            role: "lead",
            column: "In Progress",
            duration: "2m 14s",
            agentInitials: "LA"
        ),
        MobileKanbanCardItem(
            id: "card_2",
            title: "Implement Option 1 Zero-Fatigue palette across mobile SwiftUI components",
            role: "coder",
            column: "In Progress",
            duration: "1m 05s",
            agentInitials: "DC"
        ),
        MobileKanbanCardItem(
            id: "card_3",
            title: "Scan mobile and cross-platform trees for zero raw secrets and path traversal",
            role: "auditor",
            column: "Review",
            duration: "45s",
            agentInitials: "SA"
        ),
        MobileKanbanCardItem(
            id: "card_4",
            title: "Certify 5-Gate pre-flight scorecard and verify zero build warnings",
            role: "verifier",
            column: "Backlog",
            duration: "Pending",
            agentInitials: "PV"
        ),
        MobileKanbanCardItem(
            id: "card_5",
            title: "Compile CoreBlowProtocol StudioCompanionModels across shared Swift target",
            role: "coder",
            column: "Done",
            duration: "5.81s",
            agentInitials: "DC"
        )
    ]

    private let columns = ["Backlog", "In Progress", "Review", "Done"]

    var body: some View {
        NavigationStack {
            ZStack {
                CoreBlowMobileTheme.darkObsidian
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // 1. Column Filter Bar
                    columnFilterBar

                    Divider()
                        .overlay(Color.white.opacity(0.08))

                    // 2. Active Column Cards Stream
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            let filtered = self.cards.filter { $0.column == self.selectedColumn }
                            if filtered.isEmpty {
                                emptyColumnView
                            } else {
                                ForEach(filtered) { card in
                                    kanbanCardView(card: card)
                                }
                            }
                        }
                        .padding(16)
                    }

                    // 3. Bottom DAG Fleet Summary
                    fleetSummaryFooter
                }
            }
            .navigationTitle("War Room Monitor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: {
                        self.refreshWarRoomState()
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .foregroundStyle(CoreBlowMobileTheme.iceCyan)
                    }
                }
            }
        }
    }

    // ── 1. Column Filter Bar ─────────────────────────────────────────────────

    private var columnFilterBar: some View {
        HStack(spacing: 6) {
            ForEach(self.columns, id: \.self) { col in
                let count = self.cards.filter { $0.column == col }.count
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        self.selectedColumn = col
                    }
                }) {
                    HStack(spacing: 4) {
                        Text(col)
                            .font(.system(size: 11, weight: self.selectedColumn == col ? .bold : .medium))
                            .foregroundStyle(self.selectedColumn == col ? Color.white : Color.white.opacity(0.65))

                        Text("\(count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(self.selectedColumn == col ? CoreBlowMobileTheme.darkObsidian : Color.white.opacity(0.5))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(
                                Capsule()
                                    .fill(self.selectedColumn == col ? CoreBlowMobileTheme.iceCyan : Color.white.opacity(0.1))
                            )
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(self.selectedColumn == col ? CoreBlowMobileTheme.deepMutedTeal : CoreBlowMobileTheme.darkSlate)
                            .overlay(
                                Capsule()
                                    .stroke(self.selectedColumn == col ? CoreBlowMobileTheme.mutedCyan : Color.white.opacity(0.06), lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(CoreBlowMobileTheme.darkSlate.opacity(0.85))
    }

    // ── 2. Kanban Card View ──────────────────────────────────────────────────

    private func kanbanCardView(card: MobileKanbanCardItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                // Agent Role Badge
                Text(self.roleBadgeText(for: card.role))
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(self.roleBadgeColor(for: card.role))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(self.roleBadgeBg(for: card.role))
                    )

                Spacer()

                // Active Duration
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 9))
                    Text(card.duration)
                        .font(.system(size: 10, design: .monospaced))
                }
                .foregroundStyle(Color.white.opacity(0.55))
            }

            // Task Title
            Text(card.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(3)

            // Bottom Subagent Avatar & Transition Controls
            HStack {
                HStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(CoreBlowMobileTheme.mutedCyan)
                            .frame(width: 22, height: 22)
                        Text(card.agentInitials)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    Text("Subagent: \(card.role.uppercased())")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.white.opacity(0.65))
                }

                Spacer()

                // Move Task Button
                Menu {
                    ForEach(self.columns, id: \.self) { targetCol in
                        Button("Move to \(targetCol)") {
                            self.moveCard(id: card.id, to: targetCol)
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 15))
                        .foregroundStyle(CoreBlowMobileTheme.iceCyan)
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(CoreBlowMobileTheme.darkSlate)
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(CoreBlowMobileTheme.deepMutedTeal, lineWidth: 1)
                )
        )
    }

    private var emptyColumnView: some View {
        VStack(spacing: 8) {
            Image(systemName: "tray")
                .font(.system(size: 28))
                .foregroundStyle(Color.white.opacity(0.2))
            Text("No active tasks in [\(self.selectedColumn)].")
                .font(.system(size: 13))
                .foregroundStyle(Color.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // ── 3. Fleet Summary Footer ──────────────────────────────────────────────

    private var fleetSummaryFooter: some View {
        HStack(spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 11))
                    .foregroundStyle(CoreBlowMobileTheme.iceCyan)
                Text("Fleet: 4 Agents Active")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.85))
            }

            Spacer()

            HStack(spacing: 4) {
                Circle()
                    .fill(CoreBlowMobileTheme.sageGreen)
                    .frame(width: 7, height: 7)
                Text("DAG Synchronized")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(CoreBlowMobileTheme.sageGreen)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(CoreBlowMobileTheme.darkObsidian)
    }

    private func moveCard(id: String, to target: String) {
        if let idx = self.cards.firstIndex(where: { $0.id == id }) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                let updated = MobileKanbanCardItem(
                    id: self.cards[idx].id,
                    title: self.cards[idx].title,
                    role: self.cards[idx].role,
                    column: target,
                    duration: self.cards[idx].duration,
                    agentInitials: self.cards[idx].agentInitials
                )
                self.cards[idx] = updated
            }
        }
    }

    private func refreshWarRoomState() {
        Task {
            guard let url = URL(string: "http://127.0.0.1:18789/api/corehub/desktop/state") else { return }
            guard let (data, resp) = try? await URLSession.shared.data(from: url),
                  let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else { return }
            _ = data
        }
    }

    private func roleBadgeText(for role: String) -> String {
        switch role {
        case "lead": return "LEAD ARCHITECT"
        case "coder": return "DEEP CODER"
        case "auditor": return "SECURITY AUDITOR"
        case "verifier": return "PRE-FLIGHT VERIFIER"
        default: return role.uppercased()
        }
    }

    private func roleBadgeColor(for role: String) -> Color {
        switch role {
        case "lead": return CoreBlowMobileTheme.iceCyan
        case "coder": return CoreBlowMobileTheme.sageGreen
        case "auditor": return Color.orange
        case "verifier": return CoreBlowMobileTheme.mutedCyan
        default: return .white
        }
    }

    private func roleBadgeBg(for role: String) -> Color {
        switch role {
        case "lead": return CoreBlowMobileTheme.deepMutedTeal
        case "coder": return Color(red: 20/255.0, green: 45/255.0, blue: 35/255.0)
        case "auditor": return Color(red: 45/255.0, green: 30/255.0, blue: 15/255.0)
        case "verifier": return CoreBlowMobileTheme.darkSlate
        default: return Color.black.opacity(0.4)
        }
    }
}
