import SwiftUI
struct VoiceWakeTranscriptView: View { let transcript: String; var body: some View { Text(transcript).font(.caption).foregroundStyle(.secondary).lineLimit(2) } }
struct VoiceWakeCommandView: View { let command: String; var body: some View { Text(command).font(.body.bold()) } }
