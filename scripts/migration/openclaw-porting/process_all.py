import sys
import re

pairs = [
    # File 2
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/Logging/OpenClawLogging.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/Logging/CoreBlowLogging.swift"),
    # File 3
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/OpenClawPaths.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/CoreBlowPaths.swift"),
    # File 4
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/ProcessInfo+OpenClaw.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/ProcessInfo+CoreBlow.swift"),
    # File 5
    ("/Users/febrinanda/openclaw-main/apps/macos/Tests/OpenClawIPCTests/OpenClawConfigFileTests.swift", "/Users/febrinanda/coreblow/apps/macos/Tests/CoreBlowIPCTests/CoreBlowConfigFileTests.swift"),
    # File 6
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/ChannelsSettings.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/ChannelsSettings.swift"),
    # File 7
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/CronSettings.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/CronSettings.swift"),
    # File 8
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClawMacCLI/GatewayScopes.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlowMacCLI/GatewayScopes.swift"),
    # File 9
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/String+NonEmpty.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/String+NonEmpty.swift"),
    # File 10
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClaw/TalkModeTypes.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlow/TalkModeTypes.swift"),
    # File 11
    ("/Users/febrinanda/openclaw-main/apps/macos/Sources/OpenClawMacCLI/TypeAliases.swift", "/Users/febrinanda/coreblow/apps/macos/Sources/CoreBlowMacCLI/TypeAliases.swift"),
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
