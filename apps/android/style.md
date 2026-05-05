# CoreBlow Android Style Guide

## Kotlin

- Use Kotlin coding conventions: https://kotlinlang.org/docs/coding-conventions.html
- Max line length: 120 characters
- Indent: 4 spaces
- Use trailing commas in multi-line parameter lists
- Prefer `val` over `var`
- Use data classes for models
- Use sealed classes for UI state

## Compose

- Composable functions: PascalCase (e.g., `ChatScreen`, `MessageItem`)
- State hoisting: lift state to the caller
- Use `remember` and `derivedStateOf` for computed values
- Previews: annotate with `@Preview` and provide sample data

## Architecture

- MVVM with ViewModels
- Repository pattern for data access
- Single Activity with Compose Navigation
- WorkManager for background tasks
- Hilt for dependency injection (planned)

## Naming

- Packages: lowercase, no underscores
- Classes: PascalCase
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- XML resources: snake_case with prefix (`activity_`, `fragment_`, `item_`)
