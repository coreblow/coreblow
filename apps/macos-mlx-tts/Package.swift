// swift-tools-version: 6.2
// Isolated MLX TTS helper package. Kept separate from apps/macos/Package.swift
// so that standard macOS app tests do not need to compile the full MLX audio stack.

import PackageDescription

let package = Package(
    name: "CoreBlowMLXTTS",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .executable(name: "coreblow-mlx-tts", targets: ["CoreBlowMLXTTSHelper"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Blaizzy/mlx-audio-swift", revision: "fc4fe22dc41c053062e647a4e3db9142193670d2"), // pragma: allowlist secret
    ],
    targets: [
        .executableTarget(
            name: "CoreBlowMLXTTSHelper",
            dependencies: [
                .product(name: "MLXAudioTTS", package: "mlx-audio-swift"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
    ])
