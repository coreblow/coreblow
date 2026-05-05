import SwiftUI

/// Tab view displaying the canvas WebView and navigation controls.
struct ScreenTab: View {
    @Bindable var model: NodeAppModel

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScreenWebView(controller: model.screen)
                    .ignoresSafeArea(edges: .bottom)

                if model.screen.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
            }
            .navigationTitle(model.screen.pageTitle ?? "Screen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button { model.screen.goBack() } label: {
                        Image(systemName: "chevron.left")
                    }
                    .disabled(!model.screen.canGoBack)

                    Button { model.screen.goForward() } label: {
                        Image(systemName: "chevron.right")
                    }
                    .disabled(!model.screen.canGoForward)

                    Spacer()

                    Button { model.screen.reload() } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }
}
