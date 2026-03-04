/**
 * src/cli/skillhub.ts
 * CLI: coreblow skillhub — manage skills (install, list, update, remove)
 */

import fs from 'node:fs';
import path from 'node:path';
import { getHomeDir } from '../gateway/config.js';
import { parseSkillFile } from '../skills/parser.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cli:skillhub');

// Built-in skill templates
const SKILL_CATALOG: Record<string, { description: string; content: string }> = {
    'notion': {
        description: 'Create, read, and search Notion databases and pages',
        content: `---
name: notion
description: Create, read, and search Notion databases and pages via REST API
homepage: https://notion.so
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "NOTION_API_KEY"}
---
## Notion Operating Instructions
You can manage Notion workspaces. Use the web_fetch tool to call Notion API.

### Available Operations
- **Search**: POST https://api.notion.com/v1/search with body {"query": "keyword"}
- **Read page**: GET https://api.notion.com/v1/pages/{page_id}
- **Read database**: POST https://api.notion.com/v1/databases/{db_id}/query
- **Create page**: POST https://api.notion.com/v1/pages with parent and properties
- **Update page**: PATCH https://api.notion.com/v1/pages/{page_id}

### Headers (auto-injected)
- Authorization: Bearer $NOTION_API_KEY
- Notion-Version: 2022-06-28
- Content-Type: application/json

### Important Rules
- Always search first before creating to avoid duplicates
- Handle pagination (has_more + start_cursor)
- Parse property schemas from database before writing`,
    },
    'obsidian': {
        description: 'Manage Obsidian vault notes using local filesystem',
        content: `---
name: obsidian
description: Read, create, and edit Obsidian vault notes via filesystem
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Obsidian Vault Manager
You can manage the user's Obsidian vault using filesystem commands.

### Configuration
Ask the user for their vault path (e.g., ~/Documents/Obsidian) if not set.

### Operations
- **List notes**: Use exec with \`find <vault_path> -name "*.md" | head -50\`
- **Read note**: Use exec with \`cat "<vault_path>/note.md"\`
- **Create note**: Use exec with appropriate write commands
- **Search**: Use exec with \`grep -rl "keyword" <vault_path>/\`

### Best Practices
- Use Zettelkasten format: include [[wikilinks]] and #tags
- Maintain proper YAML frontmatter
- Keep backlinks consistent`,
    },
    'github': {
        description: 'Manage GitHub repos, issues, PRs via REST API',
        content: `---
name: github
description: Create issues, review PRs, manage repos via GitHub REST API
homepage: https://github.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "GITHUB_TOKEN"}
---
## GitHub Manager
Manage GitHub repositories using the REST API via web_fetch.

### Headers (auto-injected)
- Authorization: Bearer $GITHUB_TOKEN
- Accept: application/vnd.github.v3+json

### Available Operations
- **List repos**: GET https://api.github.com/user/repos
- **Create issue**: POST https://api.github.com/repos/{owner}/{repo}/issues
- **List PRs**: GET https://api.github.com/repos/{owner}/{repo}/pulls
- **Create PR**: POST https://api.github.com/repos/{owner}/{repo}/pulls
- **Review PR**: POST https://api.github.com/repos/{owner}/{repo}/pulls/{pr}/reviews
- **Search code**: GET https://api.github.com/search/code?q={query}

### Best Practices
- Always check existing issues before creating duplicates
- Use descriptive titles and labels
- Include code snippets in issue body when relevant`,
    },
    'trello': {
        description: 'Manage Trello boards, lists, and cards',
        content: `---
name: trello
description: Create and manage Trello boards, lists, and cards
homepage: https://trello.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "TRELLO_API_KEY", "secondaryEnv": "TRELLO_TOKEN"}
---
## Trello Board Manager
Manage Trello boards using REST API.

### API Base: https://api.trello.com/1

### Operations
- **List boards**: GET /members/me/boards?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN
- **Get board**: GET /boards/{id}?key=$TRELLO_API_KEY&token=$TRELLO_TOKEN
- **Create card**: POST /cards?idList={listId}&name={name}&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN
- **Move card**: PUT /cards/{id}?idList={newListId}&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN
- **Add comment**: POST /cards/{id}/actions/comments?text={text}&key=$TRELLO_API_KEY&token=$TRELLO_TOKEN`,
    },
    'weather': {
        description: 'Get weather data from OpenWeatherMap',
        content: `---
name: weather
description: Get current weather and forecasts for any location
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "OPENWEATHER_API_KEY"}
---
## Weather Service
Provide weather information using OpenWeatherMap API.

### Endpoints
- **Current**: https://api.openweathermap.org/data/2.5/weather?q={city}&appid=$OPENWEATHER_API_KEY&units=metric
- **Forecast**: https://api.openweathermap.org/data/2.5/forecast?q={city}&appid=$OPENWEATHER_API_KEY&units=metric

### Response Format
Present weather data in a friendly, readable format:
- Temperature (°C), feels like
- Weather condition + emoji (☀️ 🌧️ ❄️ 🌤️)
- Humidity, wind speed
- Forecast summary for next 3 days`,
    },
    'home-assistant': {
        description: 'Control smart home devices via Home Assistant',
        content: `---
name: home-assistant
description: Control lights, switches, sensors via Home Assistant REST API
homepage: https://home-assistant.io
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "HA_TOKEN", "baseUrl": "http://homeassistant.local:8123"}
---
## Home Assistant Controller
Control smart home devices through Home Assistant.

### Headers
- Authorization: Bearer $HA_TOKEN
- Content-Type: application/json

### Operations
- **List entities**: GET {baseUrl}/api/states
- **Get state**: GET {baseUrl}/api/states/{entity_id}
- **Call service**: POST {baseUrl}/api/services/{domain}/{service}
  Body: {"entity_id": "light.living_room"}
- **Toggle**: POST {baseUrl}/api/services/homeassistant/toggle

### Common Services
- light.turn_on, light.turn_off (brightness, color_temp)
- switch.turn_on, switch.turn_off
- climate.set_temperature (temperature)
- media_player.play_media`,
    },
    'spotify': {
        description: 'Control Spotify playback and search music',
        content: `---
name: spotify
description: Search tracks, control playback, manage playlists via Spotify API
homepage: https://spotify.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "SPOTIFY_TOKEN"}
---
## Spotify Controller
Control Spotify playback and search music.

### Headers
- Authorization: Bearer $SPOTIFY_TOKEN

### API Base: https://api.spotify.com/v1

### Operations
- **Search**: GET /search?q={query}&type=track&limit=5
- **Play**: PUT /me/player/play with body {"uris": ["spotify:track:..."]}
- **Pause**: PUT /me/player/pause
- **Next**: POST /me/player/next
- **Devices**: GET /me/player/devices (check active player first!)
- **Queue**: POST /me/player/queue?uri=spotify:track:xxx
- **Playlists**: GET /me/playlists`,
    },
    'calendar': {
        description: 'Manage Google Calendar events',
        content: `---
name: calendar
description: Create, list, and manage Google Calendar events
homepage: https://calendar.google.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "GOOGLE_CALENDAR_TOKEN"}
---
## Google Calendar Manager
Manage calendar events via Google Calendar API.

### Headers
- Authorization: Bearer $GOOGLE_CALENDAR_TOKEN

### API Base: https://www.googleapis.com/calendar/v3

### Operations
- **List events**: GET /calendars/primary/events?timeMin={now}&maxResults=10
- **Create event**: POST /calendars/primary/events
  Body: {"summary": "Meeting", "start": {"dateTime": "..."}, "end": {"dateTime": "..."}}
- **Delete event**: DELETE /calendars/primary/events/{eventId}
- **Update event**: PATCH /calendars/primary/events/{eventId}

### Date format: ISO 8601 with timezone (e.g., 2024-01-15T10:00:00+07:00)`,
    },
    'apple-reminders': {
        description: 'Manage Apple Reminders (macOS only)',
        content: `---
name: apple-reminders
description: Create, list, complete Apple Reminders via AppleScript
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "darwin"}
---
## Apple Reminders (macOS)
Manage Apple Reminders using AppleScript/osascript.

### Operations
- **List reminders**: osascript -e 'tell application "Reminders" to get name of every reminder in list "Reminders"'
- **Add reminder**: osascript -e 'tell application "Reminders" to make new reminder in list "Reminders" with properties {name:"Buy milk", due date:date "01/15/2024"}'
- **Complete**: osascript -e 'tell application "Reminders" to set completed of reminder "Buy milk" to true'
- **Lists**: osascript -e 'tell application "Reminders" to get name of every list'`,
    },
    'apple-notes': {
        description: 'Search and create Apple Notes (macOS only)',
        content: `---
name: apple-notes
description: Search, create, and read Apple Notes via AppleScript
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "darwin"}
---
## Apple Notes (macOS)
Access Apple Notes using AppleScript.

### Operations
- **List notes**: osascript -e 'tell application "Notes" to get name of every note in folder "Notes"'
- **Read note**: osascript -e 'tell application "Notes" to get body of note "Note Title"'
- **Create note**: osascript -e 'tell application "Notes" to make new note in folder "Notes" with properties {name:"Title", body:"Content"}'
- **Search**: osascript -e 'tell application "Notes" to get name of every note whose name contains "keyword"'`,
    },
    '1password': {
        description: 'Access 1Password secrets securely (host-restricted)',
        content: `---
name: 1password
description: Read passwords and secrets from 1Password CLI (host-only, never in sandbox)
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"hostRestricted": true, "primaryEnv": "OP_SERVICE_ACCOUNT_TOKEN"}
---
## 1Password Secrets (Host-Restricted)
Access 1Password items using the op CLI. SECURITY: Only execute on gateway host, never in sandbox.

### Operations
- **Read secret**: op read "op://Vault/Item/field"
- **List items**: op item list --vault "Personal"
- **Get item**: op item get "Item Name" --vault "Personal" --format json

### CRITICAL SECURITY RULES
- NEVER print secrets to chat
- Use secrets only as intermediate values for other API calls
- Results stay in agent memory only, never echoed to user`,
    },
    'hue': {
        description: 'Control Philips Hue lights',
        content: `---
name: hue
description: Control Philips Hue lights via local bridge API
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "HUE_BRIDGE_IP", "secondaryEnv": "HUE_USERNAME"}
---
## Philips Hue Controller
Control Hue lights via the local bridge REST API.

### API Base: http://$HUE_BRIDGE_IP/api/$HUE_USERNAME

### Operations
- **List lights**: GET /lights
- **Get light**: GET /lights/{id}
- **Turn on**: PUT /lights/{id}/state with {"on": true}
- **Turn off**: PUT /lights/{id}/state with {"on": false}
- **Set color**: PUT /lights/{id}/state with {"on": true, "hue": 46920, "sat": 254, "bri": 254}
- **Set brightness**: PUT /lights/{id}/state with {"bri": 128} (0-254)
- **List scenes**: GET /scenes
- **Activate scene**: PUT /groups/0/action with {"scene": "scene_id"}`,
    },
};

export async function skillhubCommand(action?: string, name?: string) {
    const homeDir = getHomeDir();
    const skillsDir = path.join(homeDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    switch (action) {
        case 'install': {
            if (!name) {
                console.log('Usage: coreblow skillhub install <skill-name>');
                console.log('\nAvailable skills:');
                for (const [key, val] of Object.entries(SKILL_CATALOG)) {
                    console.log(`  ${key.padEnd(20)} ${val.description}`);
                }
                return;
            }

            const skill = SKILL_CATALOG[name];
            if (!skill) {
                console.log(`Unknown skill: ${name}`);
                console.log('Run "coreblow skillhub install" to see available skills.');
                return;
            }

            const skillDir = path.join(skillsDir, name);
            fs.mkdirSync(skillDir, { recursive: true });
            fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.content);

            console.log(`✅ Skill "${name}" installed to ${skillDir}`);
            console.log(`   ${skill.description}`);

            // Check for env requirements
            const parsed = parseSkillFile(path.join(skillDir, 'SKILL.md'));
            if (parsed?.meta.metadata?.primaryEnv) {
                console.log(`\n⚠️  This skill requires: ${parsed.meta.metadata.primaryEnv}`);
                console.log(`   Set it in ~/.coreblow/config.json under skills.entries.${name}.env`);
            }
            break;
        }

        case 'list': {
            const installed = fs.readdirSync(skillsDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')));

            if (installed.length === 0) {
                console.log('No skills installed. Run: coreblow skillhub install');
                return;
            }

            console.log(`\n📦 Installed Skills (${installed.length}):\n`);
            for (const dir of installed) {
                const parsed = parseSkillFile(path.join(skillsDir, dir.name, 'SKILL.md'));
                const status = parsed ? '✅' : '❌';
                console.log(`  ${status} ${dir.name.padEnd(20)} ${parsed?.meta.description || 'Invalid SKILL.md'}`);
            }

            console.log(`\n📚 Available (${Object.keys(SKILL_CATALOG).length} total). Run: coreblow skillhub install`);
            break;
        }

        case 'remove': {
            if (!name) { console.log('Usage: coreblow skillhub remove <skill-name>'); return; }
            const skillDir = path.join(skillsDir, name);
            if (fs.existsSync(skillDir)) {
                fs.rmSync(skillDir, { recursive: true });
                console.log(`✅ Skill "${name}" removed.`);
            } else {
                console.log(`Skill "${name}" not installed.`);
            }
            break;
        }

        case 'catalog': {
            console.log(`\n📚 Skill Catalog (${Object.keys(SKILL_CATALOG).length} skills):\n`);
            for (const [key, val] of Object.entries(SKILL_CATALOG)) {
                console.log(`  📦 ${key.padEnd(20)} ${val.description}`);
            }
            console.log('\nInstall: coreblow skillhub install <name>');
            break;
        }

        default:
            console.log('Usage: coreblow skillhub <install|list|remove|catalog> [name]');
            console.log('');
            console.log('  install <name>  Install a skill from the catalog');
            console.log('  list            List installed skills');
            console.log('  remove <name>   Remove an installed skill');
            console.log('  catalog         Browse all available skills');
    }
}
