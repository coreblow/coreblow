import Foundation

@main
struct CoreBlowMacCLI {
    static func main() async {
        let args = Array(CommandLine.arguments.dropFirst())
        guard let subcommand = args.first else {
            printUsage(); return
        }
        do {
            switch subcommand {
            case "connect": try await ConnectCommand.run(Array(args.dropFirst()))
            case "discover": try await DiscoverCommand.run(Array(args.dropFirst()))
            case "wizard": try await WizardCommand.run(Array(args.dropFirst()))
            case "--help", "-h": printUsage()
            default:
                FileHandle.standardError.write(Data("Unknown command: \(subcommand)\n".utf8))
                printUsage(); exit(1)
            }
        } catch {
            FileHandle.standardError.write(Data("coreblow-mac: \(error)\n".utf8))
            exit(1)
        }
    }

    private static func printUsage() {
        let usage = """
        usage: coreblow-mac <command> [options]

        Commands:
          connect   Connect to a gateway
          discover  Discover gateways on the network
          wizard    Interactive setup wizard
        """
        print(usage)
    }
}
