# App Store metadata (Fastlane deliver)

This directory is used by `fastlane deliver` for App Store Connect text metadata.

## Upload metadata only

```bash
bundle exec fastlane deliver --skip_binary_upload --skip_screenshots
```

## Directory structure

```
metadata/
├── review_information/     # App Review team contact info
│   ├── phone_number.txt
│   ├── email_address.txt
│   ├── first_name.txt
│   ├── last_name.txt
│   └── notes.txt
└── en-US/                  # English (US) locale
    ├── name.txt
    ├── subtitle.txt
    ├── description.txt
    ├── keywords.txt
    ├── release_notes.txt
    ├── marketing_url.txt
    ├── support_url.txt
    ├── privacy_url.txt
    └── promotional_text.txt
```
