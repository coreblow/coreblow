import sys

paths = [
    "apps/macos/Sources/CoreBlow/CoreBlowPaths.swift",
    "apps/macos/Sources/CoreBlow/ProcessInfo+CoreBlow.swift",
    "apps/macos/Tests/CoreBlowIPCTests/CoreBlowConfigFileTests.swift",
]

for dst in paths:
    with open(dst, "r") as f:
        content = f.read()

    content = content.replace("OPENCLAW", "COREBLOW")

    with open(dst, "w") as f:
        f.write(content)
