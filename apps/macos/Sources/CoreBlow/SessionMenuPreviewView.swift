import SwiftUI
struct SessionMenuPreviewView: View { let session: SessionData
    var body: some View { VStack(alignment: .leading, spacing: 4) { Text(session.displayName).font(.headline); if let model = session.modelName { Text(model).font(.caption).foregroundStyle(.secondary) }; Text(SessionActions.formatSessionAge(session.startedAt)).font(.caption2) }.padding() }
}
