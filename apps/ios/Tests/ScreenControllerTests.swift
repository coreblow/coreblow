import Testing
@testable import CoreBlow

@Suite("ScreenController")
struct ScreenControllerTests {
    @Test @MainActor func initialStateIsIdle() {
        let controller = ScreenController()
        #expect(controller.currentURL == nil)
        #expect(!controller.isLoading)
        #expect(!controller.canGoBack)
        #expect(!controller.canGoForward)
    }

    @Test @MainActor func navigateSetsCurrentURL() {
        let controller = ScreenController()
        controller.configure()
        controller.navigate(to: "https://coreblow.com")
        #expect(controller.currentURL == "https://coreblow.com")
    }

    @Test @MainActor func showDefaultCanvasClearsURL() {
        let controller = ScreenController()
        controller.configure()
        controller.navigate(to: "https://example.com")
        controller.showDefaultCanvas()
        #expect(controller.currentURL == nil)
        #expect(controller.pageTitle == "Home")
    }
}
