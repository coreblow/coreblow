import Foundation
enum CLIInstaller { static func install() { let src = Bundle.main.url(forAuxiliaryExecutable: "coreblow-mac"); let dst = URL(fileURLWithPath: "/usr/local/bin/coreblow-mac"); guard let src else { return }; try? FileManager.default.copyItem(at: src, to: dst) }; static func isInstalled() -> Bool { FileManager.default.fileExists(atPath: "/usr/local/bin/coreblow-mac") } }
