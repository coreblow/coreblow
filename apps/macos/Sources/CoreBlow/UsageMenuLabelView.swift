import SwiftUI
struct UsageMenuLabelView: View { let data: UsageData
    var body: some View { HStack { Text(data.sessionId.prefix(8)); Spacer(); Text("\(data.tokens) tok").font(.caption2) }.padding(.horizontal) }
}
