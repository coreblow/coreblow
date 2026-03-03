---
name: peekaboo
description: "Screen peek — capture and analyze what's on screen. SUPERIOR: OCR, element detection, accessibility tree."
author: CoreBlow
category: media
user-invocable: true
---

# Ultra Peekaboo

Screen capture and analysis.

## When to Use
 "What's on my screen?", "Read text from screen", "Analyze this window"

## Commands

```bash
# Capture screen
screencapture -x /tmp/peek.png

# Capture specific window
screencapture -l $(osascript -e 'tell app "System Events" to id of first window of first process whose frontmost is true') /tmp/peek.png

# Screen size
system_profiler SPDisplaysDataType | grep Resolution
```

## Guidelines
- Capture first, then analyze the image with vision AI
- Use OCR for text extraction
- Check accessibility tree for structured data
