---
name: camsnap
description: "Camera snapshot — capture photo from webcam/screen. SUPERIOR: timed capture, face detection, auto-crop."
author: CoreBlow
category: media
user-invocable: true
---

# Ultra CamSnap

Camera and screen capture.

## When to Use
 "Take a photo", "Capture webcam", "Screenshot"

## Commands

```bash
# Webcam snapshot (macOS)
ffmpeg -f avfoundation -framerate 30 -i "0" -frames:v 1 -y /tmp/webcam.jpg

# Screen capture
screencapture -x /tmp/screenshot.png

# Screen capture with delay
screencapture -T 3 /tmp/screenshot.png

# Specific window
screencapture -w /tmp/window.png

# Screen recording (5 seconds)
screencapture -v -V 5 /tmp/recording.mov
```
