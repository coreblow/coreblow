import Foundation
@MainActor final class MacNodeRuntimeMainActorServices {
    let screenCommands = MacNodeScreenCommands.self; let browserProxy = MacNodeBrowserProxy()
    let locationService = MacNodeLocationService()
}
