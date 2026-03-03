---
name: gemini
description: "Google Gemini API — multimodal AI (text, image, video, audio). SUPERIOR: native multimodal, 1M token context, grounding with Google Search."
author: CoreBlow
category: ai
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Gemini

Google Gemini multimodal AI integration.

## When to Use

 "Analyze this image with Gemini", "Use Gemini for...", "Long document analysis" (1M context)

 Default AI tasks → use configured provider | Image gen → use `openai-image-gen`

## Commands

```bash
# Text generation
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"contents":[{"parts":[{"text":"Explain quantum computing"}]}]}'

# Image analysis (multimodal)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"contents":[{"parts":[{"text":"Describe this image"},{"inline_data":{"mime_type":"image/jpeg","data":"'$(base64 -i image.jpg)'"}}]}]}'

# Long document (1M context)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"contents":[{"parts":[{"text":"Summarize: '"$(cat long_doc.txt)"'"}]}]}'
```

### Models
| Model | Context | Best For |
|-------|---------|----------|
| `gemini-2.0-flash` | 1M | Fast, multimodal |
| `gemini-2.0-pro` | 1M | Complex reasoning |
| `gemini-2.5-pro` | 1M | Latest, highest quality |

## Guidelines
- Use Flash for speed, Pro for quality
- Leverage 1M context for full codebases/documents
