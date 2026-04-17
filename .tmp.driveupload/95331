// swift-tools-version: 5.10

import PackageDescription

let package = Package(
    name: "CoreBlowKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "CoreBlowProtocol", targets: ["CoreBlowProtocol"]),
        .library(name: "CoreBlowKit", targets: ["CoreBlowKit"]),
        .library(name: "CoreBlowChatUI", targets: ["CoreBlowChatUI"]),
    ],
    targets: [
        .target(
            name: "CoreBlowProtocol",
            path: "Sources/CoreBlowProtocol"),
        .target(
            name: "CoreBlowKit",
            dependencies: ["CoreBlowProtocol"],
            path: "Sources/CoreBlowKit",
            resources: [.process("Resources")]),
        .target(
            name: "CoreBlowChatUI",
            dependencies: ["CoreBlowKit"],
            path: "Sources/CoreBlowChatUI"),
        .testTarget(
            name: "CoreBlowKitTests",
            dependencies: ["CoreBlowKit", "CoreBlowChatUI", "CoreBlowProtocol"],
            path: "Tests/CoreBlowKitTests"),
    ])
