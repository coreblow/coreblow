# CoreBlow Android

Android native app for CoreBlow — Autonomous AI agents that run anywhere.

**Status:** alpha

## Features

- 💬 Chat UI with Jetpack Compose + Material 3
- ⌚ Wear OS companion app (5 screens)
- 📱 Glance widgets (5 types: Chat, Model, QuickChat, Status, Usage)
- 🔐 Biometric lock + encrypted storage
- 🔔 Push notifications
- 🌍 7 languages (en, de, es, fr, ja, ko, zh)
- 🔄 10 background workers (sync, backup, health check, etc.)

## Build / Run

```bash
cd apps/android

# Debug build (Play flavor)
./gradlew :app:assemblePlayDebug
./gradlew :app:installPlayDebug

# Third-party flavor (F-Droid / direct APK)
./gradlew :app:assembleThirdPartyDebug

# Unit tests
./gradlew :app:testPlayDebugUnitTest

# Release build (requires signing config)
./gradlew :app:assemblePlayRelease
```

## Open in Android Studio

Open the folder `apps/android` in Android Studio.

## Project Structure

```
apps/android/
├── app/                          ← Application module
│   ├── src/main/java/com/coreblow/app/
│   │   ├── animation/            ← UI animations
│   │   ├── database/             ← Room database
│   │   ├── di/                   ← Dependency injection
│   │   ├── model/                ← Data models
│   │   ├── navigation/           ← Navigation graph
│   │   ├── network/              ← API client (Retrofit)
│   │   ├── repository/           ← Data repositories
│   │   ├── service/              ← Android services
│   │   ├── ui/compose/           ← Compose screens
│   │   ├── viewmodel/            ← ViewModels
│   │   ├── wear/                 ← Wear OS screens
│   │   ├── widget/               ← Glance widgets
│   │   └── worker/               ← WorkManager workers
│   ├── src/main/res/             ← Resources & layouts
│   └── src/test/                 ← Unit tests
├── gradle/wrapper/               ← Gradle wrapper
├── build.gradle.kts              ← Root project config
├── settings.gradle.kts           ← Module includes
└── gradle.properties             ← Build properties
```
