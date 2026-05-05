# CoreBlow iOS Versioning

## Scheme

CoreBlow iOS follows CalVer-aligned versioning tied to the main project:

- `MARKETING_VERSION`: Matches the root project version (e.g., `1.0.0`)
- `CURRENT_PROJECT_VERSION`: Auto-incrementing build number
- Both values are managed in `Config/Version.xcconfig`

## Bumping Versions

Update `Config/Version.xcconfig` and `version.json`:

```bash
# Example: bump build number
sed -i '' 's/CURRENT_PROJECT_VERSION = .*/CURRENT_PROJECT_VERSION = 13/' Config/Version.xcconfig
```

## CI Integration

The `version.json` file is read by CI scripts to determine the current version without parsing xcconfig files.
