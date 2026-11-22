import sys
import re

pairs = [
    # File 2
    ("apps/macos/Sources/CoreBlow/Logging/CoreBlowLogging.swift", "apps/macos/Sources/CoreBlow/Logging/CoreBlowLogging.swift"),
    # File 3
    ("apps/macos/Sources/CoreBlow/CoreBlowPaths.swift", "apps/macos/Sources/CoreBlow/CoreBlowPaths.swift"),
    # File 4
    ("apps/macos/Sources/CoreBlow/ProcessInfo+CoreBlow.swift", "apps/macos/Sources/CoreBlow/ProcessInfo+CoreBlow.swift"),
    # File 5
    ("apps/macos/Tests/CoreBlowIPCTests/CoreBlowConfigFileTests.swift", "apps/macos/Tests/CoreBlowIPCTests/CoreBlowConfigFileTests.swift"),
    # File 6
    ("apps/macos/Sources/CoreBlow/ChannelsSettings.swift", "apps/macos/Sources/CoreBlow/ChannelsSettings.swift"),
    # File 7
    ("apps/macos/Sources/CoreBlow/CronSettings.swift", "apps/macos/Sources/CoreBlow/CronSettings.swift"),
    # File 8
    ("apps/macos/Sources/CoreBlowMacCLI/GatewayScopes.swift", "apps/macos/Sources/CoreBlowMacCLI/GatewayScopes.swift"),
    # File 9
    ("apps/macos/Sources/CoreBlow/String+NonEmpty.swift", "apps/macos/Sources/CoreBlow/String+NonEmpty.swift"),
    # File 10
    ("apps/macos/Sources/CoreBlow/TalkModeTypes.swift", "apps/macos/Sources/CoreBlow/TalkModeTypes.swift"),
    # File 11
    ("apps/macos/Sources/CoreBlowMacCLI/TypeAliases.swift", "apps/macos/Sources/CoreBlowMacCLI/TypeAliases.swift"),
]

for src, dst in pairs:
    print(f"Processing {src} -> {dst}")
    with open(src, "r") as f:
        content = f.read()

    # Apply substitutions
    content = content.replace("OpenClaw", "CoreBlow")
    content = content.replace("openclaw", "coreblow")
    content = content.replace("openClaw", "coreBlow")

    # Prefix OC -> CB, e.g., OCLogger -> CBLogger
    content = re.sub(r'\bOC([A-Z])', r'CB\1', content)

    with open(dst, "w") as f:
        f.write(content)
