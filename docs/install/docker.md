# Docker Installation

```bash
docker pull coreblow/coreblow:latest
docker run -p 3000:3000 \
  -e COREBLOW_GATEWAY_TOKEN=change-me \
  coreblow/coreblow \
  node coreblow.mjs gateway --bind lan --port 3000
```
