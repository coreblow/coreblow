# CoreBlow Windows Node

Windows companion suite for CoreBlow.

This repository is the Windows platform surface for CoreBlow: tray status,
local node identity, and Windows-specific integration points. It stays outside
`coreblow/coreblow` so platform code can ship and test independently.

## Development

```powershell
dotnet test
```
