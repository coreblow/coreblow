---
name: openai-whisper
description: "Local speech-to-text via Whisper — transcribe audio/video files offline. SUPERIOR: multi-language, word-level timestamps, speaker diarization, subtitle export."
author: CoreBlow
category: ai
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Whisper (Local)

Offline speech-to-text using OpenAI Whisper locally.

## When to Use

 "Transcribe this audio", "Convert speech to text", "Generate subtitles for this video"

 Real-time transcription → use `openai-whisper-api` | Short clips → API may be faster

## Commands

### Transcribe Audio
```bash
# Basic transcription
whisper audio.mp3 --model medium --output_format txt

# With timestamps
whisper audio.mp3 --model large-v3 --output_format srt --word_timestamps True

# Multi-language (auto-detect)
whisper audio.mp3 --model large-v3 --task transcribe

# Translate to English
whisper foreign_audio.mp3 --model large-v3 --task translate
```

### Models (SUPERIOR: auto-select)
| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| `tiny` | 39M | | |
| `base` | 74M | | |
| `small` | 244M | | |
| `medium` | 769M | | |
| `large-v3` | 1.5G | | |

Auto-select: Use `medium` for most; `large-v3` for important/noisy audio; `tiny` for quick previews.

### Output Formats
```bash
--output_format txt # Plain text
--output_format srt # Subtitles (SRT)
--output_format vtt # WebVTT subtitles
--output_format json # JSON with timestamps
--output_format tsv # Tab-separated
```

### Extract Audio from Video
```bash
ffmpeg -i video.mp4 -vn -acodec pcm_s16le -ar 16000 audio.wav
whisper audio.wav --model medium --output_format srt
```

## Guidelines

- Use `large-v3` for production quality transcription
- Always specify output format
- For videos, extract audio first with ffmpeg
- Word-level timestamps improve subtitle accuracy
