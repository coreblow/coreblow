// swift-tools-version: 6.2
// Package manifest for the CoreBlow macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "CoreBlow",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "CoreBlowIPC", targets: ["CoreBlowIPC"]),
        .library(name: "CoreBlowDiscovery", targets: ["CoreBlowDiscovery"]),
        .executable(name: "CoreBlow", targets: ["CoreBlow"]),
        .executable(name: "coreblow-mac", targets: ["CoreBlowMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(path: "../shared/CoreBlowKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "CoreBlowIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "CoreBlowDiscovery",
            dependencies: [
                .product(name: "CoreBlowKit", package: "CoreBlowKit"),
            ],
            path: "Sources/CoreBlowDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "CoreBlow",
            dependencies: [
                "CoreBlowIPC",
                "CoreBlowDiscovery",
                .product(name: "CoreBlowKit", package: "CoreBlowKit"),
                .product(name: "CoreBlowChatUI", package: "CoreBlowKit"),
                .product(name: "CoreBlowProtocol", package: "CoreBlowKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/CoreBlow.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "CoreBlowMacCLI",
            dependencies: [
                "CoreBlowDiscovery",
                .product(name: "CoreBlowKit", package: "CoreBlowKit"),
                .product(name: "CoreBlowProtocol", package: "CoreBlowKit"),
            ],
            path: "Sources/CoreBlowMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "CoreBlowIPCTests",
            dependencies: [
                "CoreBlowIPC",
                "CoreBlow",
                "CoreBlowDiscovery",
                .product(name: "CoreBlowProtocol", package: "CoreBlowKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
