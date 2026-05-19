// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "CoreBar",
  platforms: [.macOS(.v14)],
  products: [
    .library(name: "CoreBar", targets: ["CoreBar"])
  ],
  targets: [
    .target(name: "CoreBar"),
    .testTarget(name: "CoreBarTests", dependencies: ["CoreBar"])
  ]
)
