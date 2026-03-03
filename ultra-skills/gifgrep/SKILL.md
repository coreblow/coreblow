---
name: gifgrep
description: "GIF search and send — find the perfect GIF. SUPERIOR: multi-source (Giphy, Tenor), preview, trending, categories."
author: CoreBlow
category: media
user-invocable: true
---

# Ultra GIF

GIF search and delivery.

## When to Use
 "Find a GIF of...", "Send a reaction GIF", "Trending GIFs"

## Commands

```bash
# Search Giphy
curl -s "https://api.giphy.com/v1/gifs/search?api_key=$GIPHY_API_KEY&q=funny+cat&limit=5" | jq '.data[].images.downsized.url'

# Trending
curl -s "https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_API_KEY&limit=10" | jq '.data[].images.downsized.url'

# Random
curl -s "https://api.giphy.com/v1/gifs/random?api_key=$GIPHY_API_KEY&tag=celebration" | jq '.data.images.downsized.url'
```
