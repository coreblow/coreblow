---
name: openai-image-gen
description: "AI image generation via DALL-E 3 / GPT-Image-1. SUPERIOR: batch generation, style presets, resolution control, variation generation, auto alt-text."
author: CoreBlow
category: ai
user-invocable: true
command-dispatch: tool
command-tool: shell_execute
---

# Ultra Image Gen

Generate images using OpenAI DALL-E 3 or GPT-Image-1.

## When to Use

 "Generate an image of...", "Create a logo for...", "Make a banner", "Draw me a..."

 Photo editing → use dedicated editor | Stock photos → use search

## Commands

### Generate Image
```bash
# DALL-E 3
curl -s https://api.openai.com/v1/images/generations \
 -H "Authorization: Bearer $OPENAI_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{
 "model": "dall-e-3",
 "prompt": "A futuristic cityscape at sunset, cyberpunk style",
 "n": 1,
 "size": "1024x1024",
 "quality": "hd",
 "style": "vivid"
 }' | jq -r '.data[0].url'
```

### Style Presets (SUPERIOR)
| Preset | Prompt Prefix |
|--------|--------------|
| `photorealistic` | "Ultra-realistic photograph, 8K, professional lighting," |
| `illustration` | "Digital illustration, clean lines, vibrant colors," |
| `minimalist` | "Minimalist design, clean white background, simple shapes," |
| `cyberpunk` | "Cyberpunk aesthetic, neon lights, dark atmosphere," |
| `watercolor` | "Beautiful watercolor painting, soft edges, artistic," |
| `3d-render` | "3D rendered, octane render, studio lighting," |
| `anime` | "Anime style, Studio Ghibli inspired, detailed," |
| `pixel-art` | "Pixel art style, 16-bit, retro game aesthetic," |

### Sizes
- `1024x1024` — Square (default)
- `1792x1024` — Landscape
- `1024x1792` — Portrait

### Quality
- `standard` — Faster, cheaper
- `hd` — Higher detail, better consistency

## Guidelines

- Always use `quality: "hd"` for best results
- Add style/aesthetic descriptors for better output
- Save generated images with descriptive filenames
- Provide alt-text for accessibility
