import SwiftUI
public struct ChatView: View { @State private var viewModel = ChatViewModel()
    public init() {}
    public var body: some View { VStack(spacing: 0) { ScrollView { LazyVStack(spacing: 8) { ForEach(viewModel.messages) { msg in ChatMessageBubble(message: msg) } }.padding() }; ChatComposer(text: $viewModel.inputText, onSend: viewModel.send) } }
}
