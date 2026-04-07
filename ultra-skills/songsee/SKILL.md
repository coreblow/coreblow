---
name: songsee
description: "Song recognition and lyrics — identify playing music, fetch lyrics. SUPERIOR: real-time recognition, multi-source lyrics, karaoke mode."
author: CoreBlow
category: media
user-invocable: true
---

# Ultra SongSee

Music recognition and lyrics lookup.

## When to Use
 "What song is this?", "Find lyrics for...", "Identify this music"

## Workflow
1. Capture audio (if identifying) or take song name
2. Use recognition API or lyrics search
3. Return song info + lyrics

## Commands

```bash
# Search lyrics (via API)
curl -s "https://api.lyrics.ovh/v1/artist/title"

# Identify music (Shazam-like)
# Capture 10 seconds of audio for recognition
ffmpeg -f avfoundation -i ":0" -t 10 -y /tmp/sample.wav
```
