import SwiftUI
public struct ChatComposer: View { @Binding var text: String; let onSend: () -> Void
    public var body: some View { HStack(spacing: 8) { TextField("Type a message…", text: $text).textFieldStyle(.roundedBorder).onSubmit(onSend); Button(action: onSend) { Image(systemName: "arrow.up.circle.fill").font(.title2) }.disabled(text.isEmpty) }.padding() }
}
