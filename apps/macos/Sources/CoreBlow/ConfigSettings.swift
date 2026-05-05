import SwiftUI
struct ConfigSettings: View { @State private var configText = ""; @State private var validationErrors: [String] = []
    var body: some View { VStack { TextEditor(text: $configText).font(.system(.body, design: .monospaced)).frame(minHeight: 200); if !validationErrors.isEmpty { ForEach(validationErrors, id: \.self) { e in Label(e, systemImage: "exclamationmark.triangle").foregroundStyle(.red).font(.caption) } }; HStack { Spacer(); Button("Validate") { validate() }; Button("Save") { save() }.buttonStyle(.borderedProminent) }.padding(.top, 4) }.padding() }
    private func validate() { if let data = configText.data(using: .utf8), let config = try? JSONDecoder().decode(CoreBlowConfigFile.self, from: data) { validationErrors = ConfigSchemaSupport.validate(config) } else { validationErrors = ["Invalid JSON"] } }
    private func save() { validate(); guard validationErrors.isEmpty else { return }; try? configText.data(using: .utf8)?.write(to: CoreBlowPaths.configFile, options: .atomic) }
}
