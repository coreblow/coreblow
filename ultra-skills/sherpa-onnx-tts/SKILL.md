---
name: sherpa-onnx-tts
description: "Offline text-to-speech via Sherpa-ONNX — local, private, 100+ voices. SUPERIOR: no internet needed, multi-language, SSML support, real-time streaming."
author: CoreBlow
category: ai
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra TTS (Local)

Offline text-to-speech using Sherpa-ONNX models.

## When to Use

 "Read this aloud", "Convert text to speech", "Generate voice audio"

## Commands

```bash
# List available models
sherpa-onnx-offline-tts --help

# Generate speech (VITS model)
sherpa-onnx-offline-tts \
 --vits-model=./models/vits-piper-en/en_US-lessac-medium.onnx \
 --vits-tokens=./models/vits-piper-en/tokens.txt \
 --output-filename=output.wav \
 "Hello! I am CoreBlow AI."

# Multi-language (Chinese)
sherpa-onnx-offline-tts \
 --vits-model=./models/vits-zh/model.onnx \
 --vits-tokens=./models/vits-zh/tokens.txt \
 --output-filename=output_zh.wav \
 "你好，我是CoreBlow人工智能。"
```

### Voice Models
| Language | Model | Quality |
|----------|-------|---------|
| English | `en_US-lessac-medium` | |
| English | `en_US-amy-medium` | |
| Chinese | `zh_CN-huayan` | |
| Japanese | `ja_JP-takumi` | |
| Indonesian | `id_ID-kamila` | |

## Guidelines
- Use `medium` quality models for best speed/quality balance
- Convert WAV → MP3 with: `ffmpeg -i output.wav -b:a 192k output.mp3`
