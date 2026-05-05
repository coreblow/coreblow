# 🔊 swabble — Speech.framework wake-word hook daemon (macOS 26)

A lightweight daemon that listens for a wake word using Apple's Speech.framework
SpeechAnalyzer/SpeechTranscriber pipeline, then fires a configurable hook command.

## Install

```bash
swift build -c release
cp .build/release/swabble /usr/local/bin/
swabble setup
```

## Usage

```bash
swabble serve           # Run in foreground
swabble setup           # Write default config
swabble status          # Show daemon state
swabble doctor          # Check prerequisites
swabble transcribe f.m4a # Transcribe media file
swabble test-hook "hello" # Test hook command
swabble mic-list        # List audio devices
swabble tail-log        # Show recent transcripts
```

## Config

`~/.config/swabble/config.json`
