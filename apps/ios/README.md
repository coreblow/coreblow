# CoreBlow iOS

iOS native app for CoreBlow — Autonomous AI agents that run anywhere.

**Status:** alpha

## Features

- Chat interface with SwiftUI
- Live Activity with Dynamic Island support
- Share Extension (text, URLs, images)
- watchOS companion app
- App Clips (QuickChat, Scan, Share)
- Widget extensions
- Biometric authentication
- 7 languages (en, de, es, fr, ja, ko, zh)

## Requirements

- Xcode 16+
- iOS 17.0+
- watchOS 10.0+
- Swift 5.9

## Build / Run

### From Xcode

Open `apps/ios/CoreBlow.xcodeproj` in Xcode, select the CoreBlow scheme, and build.

### With XcodeGen

```bash
cd apps/ios
xcodegen generate
open CoreBlow.xcodeproj
```

### With Fastlane

```bash
cd apps/ios

# Run tests
bundle exec fastlane test

# Build debug IPA
bundle exec fastlane build_debug

# Upload to TestFlight
bundle exec fastlane beta
```

## Signing

Copy `LocalSigning.xcconfig.example` to `LocalSigning.xcconfig` and set your development team:

```
DEVELOPMENT_TEAM = YOUR_TEAM_ID
```

This file is gitignored and will not be committed.

## Project Structure

```
apps/ios/
├── Sources/                      -- Main app source
│   ├── App.swift                 -- Entry point
│   ├── ContentView.swift         -- Root view
│   ├── Animations/               -- Custom animations
│   ├── AppClips/                 -- App Clip experiences
│   ├── Components/               -- Reusable UI components
│   ├── Coordinators/             -- Navigation coordinators
│   ├── Extensions/               -- Swift extensions
│   ├── Formatters/               -- Data formatters
│   ├── Intents/                  -- Siri intents
│   ├── Models/                   -- Data models
│   ├── Previews/                 -- SwiftUI previews
│   ├── Services/                 -- Network and data services
│   ├── ViewModels/               -- MVVM view models
│   ├── Views/                    -- Screen-level views
│   └── Widgets/                  -- WidgetKit widgets
├── Tests/                        -- Unit and accessibility tests
├── Resources/                    -- Localizations (7 languages)
├── ActivityWidget/               -- Live Activity extension
├── ShareExtension/               -- Share sheet extension
├── WatchApp/                     -- watchOS app target
├── WatchExtension/               -- watchOS extension source
├── Config/                       -- Build configuration
│   ├── Signing.xcconfig
│   └── Version.xcconfig
├── fastlane/                     -- Fastlane automation
│   ├── Appfile
│   └── Fastfile
├── CoreBlow.xcodeproj/           -- Xcode project
├── project.yml                   -- XcodeGen spec
├── version.json                  -- Machine-readable version
└── .swiftlint.yml                -- SwiftLint rules
```
