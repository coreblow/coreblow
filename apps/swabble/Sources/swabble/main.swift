import Commander
import Foundation
import Swabble

@main struct SwabbleCLI {
    static func main() async { await CLIRegistry.run() }
}
