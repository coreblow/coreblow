# fastlane setup (CoreBlow iOS)

Install:

```bash
gem install fastlane
```

Or via Bundler (recommended):

```bash
bundle install
```

## Available lanes

| Lane | Description |
|------|-------------|
| `test` | Run unit tests on iPhone 16 simulator |
| `build_debug` | Build debug IPA |
| `beta` | Build release + upload to TestFlight |
| `screenshots` | Capture App Store screenshots |

## Quick start

```bash
cd apps/ios
bundle exec fastlane test
bundle exec fastlane beta
```

## App Store Connect auth

Set up via environment variables or `.env` file. See `.env.example` in this directory.
