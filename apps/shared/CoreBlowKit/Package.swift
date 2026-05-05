// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "CoreBlowKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "CoreBlowProtocol", targets: ["CoreBlowProtocol"]),
        .library(name: "CoreBlowKit", targets: ["CoreBlowKit"]),
        .library(name: "CoreBlowChatUI", targets: ["CoreBlowChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "CoreBlowProtocol",
            path: "Sources/CoreBlowProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "CoreBlowKit",
            dependencies: [
                "CoreBlowProtocol",
            ],
            path: "Sources/CoreBlowKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "CoreBlowChatUI",
            dependencies: [
                "CoreBlowKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/CoreBlowChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "CoreBlowKitTests",
            dependencies: ["CoreBlowKit", "CoreBlowChatUI"],
            path: "Tests/CoreBlowKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
