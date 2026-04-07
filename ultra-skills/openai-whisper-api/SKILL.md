---
name: openai-whisper-api
description: "Cloud speech-to-text via OpenAI Whisper API — fast, no local GPU needed. SUPERIOR: auto-chunking large files, translation, cost tracking."
author: CoreBlow
category: ai
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Whisper API

Cloud-based transcription via OpenAI Whisper API.

## When to Use

 "Transcribe quickly", "Convert short audio", files < 25MB

 Long/large files → use local `openai-whisper` | Privacy-sensitive → use local

## Commands

```bash
# Transcribe
curl -s https://api.openai.com/v1/audio/transcriptions \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -F file="@audio.mp3" \
 -F model="whisper-1" \
 -F response_format="text"

# With timestamps (SRT)
curl -s https://api.openai.com/v1/audio/transcriptions \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -F file="@audio.mp3" \
 -F model="whisper-1" \
 -F response_format="srt"

# Translate to English
curl -s https://api.openai.com/v1/audio/translations \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -F file="@audio.mp3" \
 -F model="whisper-1"
```

### Auto-chunk Large Files (SUPERIOR)
```bash
# Split large file into 25MB chunks, transcribe each
ffmpeg -i large_audio.mp3 -f segment -segment_time 600 -c copy chunk_%03d.mp3
for f in chunk_*.mp3; do
 curl -s https://api.openai.com/v1/audio/transcriptions \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -F file="@$f" -F model="whisper-1" -F response_format="text"
done
```

## Limits & Cost
- Max file: 25MB | Supported: mp3, mp4, wav, m4a, webm
- Cost: ~$0.006/min
