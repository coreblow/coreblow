import SwiftUI
struct CostUsageMenuView: View { let cost: UsageCostData
    var body: some View { VStack(alignment: .leading, spacing: 4) { Text("Usage").font(.caption.bold()); HStack { Text("Tokens:"); Spacer(); Text("\(cost.totalTokens)") }; HStack { Text("Cost:"); Spacer(); Text(String(format: "$%.4f", cost.totalCost)) } }.font(.caption2).padding(8) }
}
