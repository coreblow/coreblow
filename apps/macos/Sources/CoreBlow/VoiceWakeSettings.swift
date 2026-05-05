import SwabbleKit
import SwiftUI
struct VoiceWakeSettings: View { @State private var enabled = false; @State private var triggerWords = "hey coreblow"
    var body: some View { Form { Toggle("Enable Voice Wake", isOn: $enabled); if enabled { TextField("Trigger Words", text: $triggerWords); VoiceWakeTestCard() } }.formStyle(.grouped) }
}
