import SwiftUI
struct WebChatSwiftUI: View { @State private var manager = WebChatManager(); @State private var input = ""
    var body: some View { VStack { ScrollView { LazyVStack(alignment: .leading) { ForEach(manager.messages) { msg in HStack { if msg.role == "user" { Spacer() }; Text(msg.content).padding(8).background(msg.role == "user" ? Color.accentColor.opacity(0.2) : Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 8)); if msg.role != "user" { Spacer() } } } } }; HStack { TextField("Message…", text: $input).textFieldStyle(.roundedBorder); Button("Send") { manager.send(input); input = "" }.disabled(input.isEmpty) }.padding() }
}
