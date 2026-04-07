---
name: video-frames
description: "Extract and analyze video frames — scene detection, key frame extraction, visual timeline. SUPERIOR: auto scene detection, thumbnail generation, content analysis."
author: CoreBlow
category: ai
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Video Frames

Extract and analyze video frames.

## When to Use
 "Extract frames from video", "Create thumbnails", "Analyze video content"

## Commands

```bash
# Extract 1 frame per second
ffmpeg -i video.mp4 -vf "fps=1" frame_%04d.jpg

# Extract key frames only (scene changes)
ffmpeg -i video.mp4 -vf "select=gt(scene\,0.3)" -vsync vfn keyframe_%04d.jpg

# Extract thumbnail at specific time
ffmpeg -i video.mp4 -ss 00:01:30 -frames:v 1 thumbnail.jpg

# Create contact sheet (4x4 grid)
ffmpeg -i video.mp4 -vf "select=not(mod(n\,100)),scale=320:180,tile=4x4" -frames:v 1 contact_sheet.jpg

# Get video info
ffprobe -v quiet -print_format json -show_streams video.mp4 | jq '.streams[0] | {width, height, duration, r_frame_rate}'
```

## Guidelines
- Use `scene` filter for intelligent key frame extraction
- Generate contact sheets for quick video overview
- Extract at native resolution for analysis, scaled for thumbnails
