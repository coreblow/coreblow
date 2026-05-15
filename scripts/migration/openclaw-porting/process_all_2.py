import sys

paths = [
    "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/CoreBlowPaths.swift",
    "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/ProcessInfo+CoreBlow.swift",
    "/Users/febrinanda/coreblow/apps/macos/Tests/CoreBlowIPCTests/CoreBlowConfigFileTests.swift",
]

for dst in paths:
    with open(dst, "r") as f:
        content = f.read()

    content = content.replace("OPENCLAW", "COREBLOW")

    with open(dst, "w") as f:
        f.write(content)
