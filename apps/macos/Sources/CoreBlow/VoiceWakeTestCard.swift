import SwiftUI
struct VoiceWakeTestCard: View { @State private var tester = VoiceWakeTester()
    var body: some View { GroupBox("Test Voice Wake") { VStack(alignment: .leading, spacing: 8) { HStack { Circle().fill(tester.isTesting ? .green : .gray).frame(width: 8, height: 8); Text(tester.isTesting ? "Listening…" : "Not listening") }; if let cmd = tester.lastCommand { Text("Command: \(cmd)").font(.caption) }; Button(tester.isTesting ? "Stop" : "Start Test") { tester.isTesting ? tester.stopTest() : tester.startTest(triggerWords: ["hey coreblow"]) } } }
}
