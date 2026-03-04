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
    'bear-notes': {
        description: 'Manage Bear notes (macOS only)',
        content: `---
name: bear-notes
description: Create, search, and manage Bear notes via x-callback-url
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "darwin"}
---
## Bear Notes (macOS)
Manage Bear notes using x-callback-url scheme.

### Operations
- **Create**: open "bear://x-callback-url/create?title=Title&text=Content&tags=tag1,tag2"
- **Search**: open "bear://x-callback-url/search?term=keyword"
- **Open note**: open "bear://x-callback-url/open-note?title=Note Title"
- **Add to note**: open "bear://x-callback-url/add-text?title=Note Title&text=Appended text"`,
    },
    'things': {
        description: 'Manage Things 3 tasks (macOS only)',
        content: `---
name: things
description: Create and manage Things 3 tasks via x-callback-url
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "darwin"}
---
## Things 3 Task Manager (macOS)
Manage tasks using Things 3 URL scheme.

### Operations
- **Add task**: open "things:///add?title=Buy%20groceries&notes=Milk%20and%20eggs&when=today"
- **Add project**: open "things:///add-project?title=Project%20Name"
- **Search**: open "things:///search?query=keyword"
- **Show today**: open "things:///show?id=today"
- **Show inbox**: open "things:///show?id=inbox"`,
    },
    'todoist': {
        description: 'Manage Todoist tasks and projects',
        content: `---
name: todoist
description: Create and manage tasks in Todoist via REST API
homepage: https://todoist.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "TODOIST_API_KEY"}
---
## Todoist Task Manager
Manage tasks using the Todoist REST API.

### Headers
- Authorization: Bearer $TODOIST_API_KEY

### API Base: https://api.todoist.com/rest/v2

### Operations
- **List tasks**: GET /tasks
- **Create task**: POST /tasks with body {"content": "Task name", "due_string": "tomorrow", "priority": 4}
- **Complete task**: POST /tasks/{id}/close
- **List projects**: GET /projects
- **Create project**: POST /projects with body {"name": "Project name"}`,
    },
    'asana': {
        description: 'Manage Asana tasks and projects',
        content: `---
name: asana
description: Create and manage Asana tasks, projects, and workspaces
homepage: https://asana.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "ASANA_TOKEN"}
---
## Asana Project Manager
Manage tasks and projects via Asana REST API.

### Headers
- Authorization: Bearer $ASANA_TOKEN

### API Base: https://app.asana.com/api/1.0

### Operations
- **List workspaces**: GET /workspaces
- **List tasks**: GET /tasks?project={project_gid}
- **Create task**: POST /tasks with body {"data": {"name": "Task", "workspace": "gid"}}
- **Complete task**: PUT /tasks/{gid} with body {"data": {"completed": true}}
- **List projects**: GET /projects?workspace={workspace_gid}`,
    },
    'linear': {
        description: 'Manage Linear issues and projects',
        content: `---
name: linear
description: Create and manage Linear issues, cycles, and projects
homepage: https://linear.app
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "LINEAR_API_KEY"}
---
## Linear Issue Tracker
Manage issues via Linear GraphQL API.

### Endpoint: POST https://api.linear.app/graphql
### Headers
- Authorization: $LINEAR_API_KEY
- Content-Type: application/json

### Queries
- **List issues**: query { issues { nodes { id title state { name } } } }
- **Create issue**: mutation { issueCreate(input: {title: "Bug", teamId: "xxx"}) { issue { id } } }
- **Search**: query { issueSearch(query: "keyword") { nodes { title url } } }`,
    },
    'jira': {
        description: 'Manage Jira issues and sprints',
        content: `---
name: jira
description: Create and manage Jira issues, sprints, and boards
homepage: https://atlassian.com/jira
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "JIRA_TOKEN", "secondaryEnv": "JIRA_URL"}
---
## Jira Project Manager
Manage issues via Jira REST API.

### Headers
- Authorization: Basic $JIRA_TOKEN (base64 email:token)
- Content-Type: application/json

### API Base: $JIRA_URL/rest/api/3

### Operations
- **Search issues**: GET /search?jql=project=PROJ AND status="In Progress"
- **Create issue**: POST /issue with body {"fields": {"project": {"key": "PROJ"}, "summary": "Title", "issuetype": {"name": "Task"}}}
- **Update status**: POST /issue/{key}/transitions
- **Add comment**: POST /issue/{key}/comment`,
    },
    'slack-api': {
        description: 'Interact with Slack workspaces via Web API',
        content: `---
name: slack-api
description: Send messages, manage channels, search Slack via Web API
homepage: https://slack.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "SLACK_BOT_TOKEN"}
---
## Slack Web API
Interact with Slack workspaces via REST API.

### Headers
- Authorization: Bearer $SLACK_BOT_TOKEN
- Content-Type: application/json

### API Base: https://slack.com/api

### Operations
- **Send message**: POST /chat.postMessage with {"channel": "C123", "text": "Hello"}
- **List channels**: GET /conversations.list
- **Search**: GET /search.messages?query=keyword
- **Upload file**: POST /files.upload
- **Set status**: POST /users.profile.set`,
    },
    'confluence': {
        description: 'Manage Confluence wiki pages',
        content: `---
name: confluence
description: Create and edit Confluence wiki pages and spaces
homepage: https://atlassian.com/confluence
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "CONFLUENCE_TOKEN", "secondaryEnv": "CONFLUENCE_URL"}
---
## Confluence Wiki Manager

### Headers
- Authorization: Basic $CONFLUENCE_TOKEN
- Content-Type: application/json

### API Base: $CONFLUENCE_URL/wiki/rest/api

### Operations
- **Search**: GET /content/search?cql=text~"keyword"
- **Get page**: GET /content/{id}?expand=body.storage
- **Create page**: POST /content with body and space key
- **Update page**: PUT /content/{id} with version number increment`,
    },
    'youtube': {
        description: 'Search YouTube videos and manage playlists',
        content: `---
name: youtube
description: Search videos, get details, manage playlists via YouTube Data API
homepage: https://youtube.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "YOUTUBE_API_KEY"}
---
## YouTube Manager

### API Base: https://www.googleapis.com/youtube/v3

### Operations
- **Search**: GET /search?part=snippet&q={query}&type=video&key=$YOUTUBE_API_KEY&maxResults=5
- **Video details**: GET /videos?part=snippet,statistics&id={videoId}&key=$YOUTUBE_API_KEY
- **Playlists**: GET /playlists?part=snippet&mine=true&key=$YOUTUBE_API_KEY
- **Captions**: GET /captions?part=snippet&videoId={id}&key=$YOUTUBE_API_KEY

### Present results with: title, channel, views, duration, URL`,
    },
    'openai-image': {
        description: 'Generate images with DALL-E / GPT-Image',
        content: `---
name: openai-image
description: Generate and edit images using OpenAI DALL-E API
homepage: https://openai.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "OPENAI_API_KEY"}
---
## OpenAI Image Generation (DALL-E)

### Endpoint: POST https://api.openai.com/v1/images/generations
### Headers
- Authorization: Bearer $OPENAI_API_KEY
- Content-Type: application/json

### Generate Image
Body: {"model": "dall-e-3", "prompt": "description", "n": 1, "size": "1024x1024", "quality": "hd"}

### Edit Image
POST https://api.openai.com/v1/images/edits with multipart form data

### Important
- Save generated URLs immediately (they expire)
- Use detailed, descriptive prompts for better results`,
    },
    'whisper': {
        description: 'Transcribe audio with OpenAI Whisper',
        content: `---
name: whisper
description: Transcribe audio files to text using OpenAI Whisper API
homepage: https://openai.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "OPENAI_API_KEY"}
---
## Whisper Speech-to-Text

### Endpoint: POST https://api.openai.com/v1/audio/transcriptions
### Headers: Authorization: Bearer $OPENAI_API_KEY

### Usage
- Send audio file as multipart/form-data with model="whisper-1"
- Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
- Max file size: 25MB
- Optional: language parameter (ISO-639-1 code)`,
    },
    'sonos': {
        description: 'Control Sonos speakers',
        content: `---
name: sonos
description: Control Sonos speakers via local REST API
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
---
## Sonos Speaker Controller

### Discovery
Use exec with: avahi-browse -r _sonos._tcp or check common IPs

### API (local HTTP)
- **Play**: POST http://{ip}:1400/MediaRenderer/AVTransport/Control
- **Pause**: Same endpoint with Pause action
- **Volume**: POST http://{ip}:1400/MediaRenderer/RenderingControl/Control
- **Group**: POST http://{ip}:1400/MediaRenderer/AVTransport/Control with group URI

### Node-sonos library can also be used via exec`,
    },
    'tmux': {
        description: 'Manage tmux sessions and windows',
        content: `---
name: tmux
description: Create and manage tmux terminal sessions, windows, and panes
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## tmux Session Manager

### Operations
- **List sessions**: tmux list-sessions
- **New session**: tmux new-session -d -s {name}
- **New window**: tmux new-window -t {session}
- **Split pane**: tmux split-window -t {session} -h (or -v)
- **Send keys**: tmux send-keys -t {session}:{window} "{command}" Enter
- **Capture output**: tmux capture-pane -t {session} -p
- **Kill session**: tmux kill-session -t {name}
- **Attach**: tmux attach -t {name}`,
    },
    'docker': {
        description: 'Manage Docker containers and images',
        content: `---
name: docker
description: Build, run, and manage Docker containers and images
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Docker Manager

### Container Operations
- **List**: docker ps -a
- **Run**: docker run -d --name {name} -p {port}:{port} {image}
- **Stop**: docker stop {container}
- **Remove**: docker rm {container}
- **Logs**: docker logs --tail 50 {container}
- **Exec**: docker exec -it {container} {command}

### Image Operations
- **List**: docker images
- **Build**: docker build -t {tag} .
- **Pull**: docker pull {image}
- **Push**: docker push {image}

### Compose
- **Up**: docker compose up -d
- **Down**: docker compose down
- **Status**: docker compose ps`,
    },
    'ssh': {
        description: 'Manage SSH connections and remote commands',
        content: `---
name: ssh
description: Execute commands on remote servers via SSH
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## SSH Remote Manager

### Operations
- **Connect**: ssh {user}@{host} "{command}"
- **Copy file**: scp {local} {user}@{host}:{remote}
- **Port forward**: ssh -L {local_port}:localhost:{remote_port} {user}@{host}
- **Key gen**: ssh-keygen -t ed25519 -C "comment"
- **Copy key**: ssh-copy-id {user}@{host}

### Security
- Always use key-based authentication
- Never store passwords in commands
- Use SSH agent: eval "$(ssh-agent -s)" && ssh-add`,
    },
    'systemd': {
        description: 'Manage systemd services (Linux)',
        content: `---
name: systemd
description: Manage systemd services, timers, and units on Linux
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "linux"}
---
## systemd Service Manager

### Service Operations
- **Status**: systemctl status {service}
- **Start**: sudo systemctl start {service}
- **Stop**: sudo systemctl stop {service}
- **Restart**: sudo systemctl restart {service}
- **Enable**: sudo systemctl enable {service}
- **Logs**: journalctl -u {service} -n 50 --no-pager

### Timer Operations
- **List timers**: systemctl list-timers
- **Create timer**: Write unit files to /etc/systemd/system/`,
    },
    'summarize': {
        description: 'Summarize long texts, articles, and documents',
        content: `---
name: summarize
description: Summarize long texts, web pages, PDFs, and documents
user-invocable: true
command-dispatch: prompt
---
## Text Summarizer

### Instructions
When asked to summarize content:
1. Identify the type: article, document, conversation, code
2. Extract key points (max 5-7 bullet points)
3. Provide a 2-3 sentence executive summary
4. Note any action items or important dates
5. Preserve critical numbers, names, and quotes

### Format
**Summary**: [2-3 sentence overview]
**Key Points**:
- Point 1
- Point 2
**Action Items**: [if any]`,
    },
    'translate': {
        description: 'Translate text between any languages',
        content: `---
name: translate
description: Translate text between languages with context awareness
user-invocable: true
command-dispatch: prompt
---
## Language Translator

### Instructions
When translating:
1. Detect source language automatically if not specified
2. Preserve tone and context (formal/casual/technical)
3. Handle idioms appropriately — don't translate literally
4. For technical terms, keep original in parentheses
5. If ambiguous, provide alternative translations

### Format
**Original** ({source_language}): {text}
**Translation** ({target_language}): {translated}
**Notes**: [context or alternatives if needed]`,
    },
    'coding-agent': {
        description: 'AI coding assistant with code review and generation',
        content: `---
name: coding-agent
description: Code review, generation, debugging, and refactoring assistant
user-invocable: true
command-dispatch: prompt
---
## Coding Agent

### Capabilities
1. **Code Review**: Analyze code for bugs, security issues, performance
2. **Generate**: Write code from natural language descriptions
3. **Debug**: Analyze errors and suggest fixes
4. **Refactor**: Improve code structure and readability
5. **Explain**: Break down complex code into plain language

### Best Practices
- Always include error handling in generated code
- Follow language-specific conventions (PEP 8, ESLint, etc.)
- Add comments for non-obvious logic
- Suggest tests for generated code
- Consider edge cases`,
    },
    'oracle': {
        description: 'Knowledge base Q&A with source citations',
        content: `---
name: oracle
description: Answer questions with accurate information and source citations
user-invocable: true
command-dispatch: prompt
---
## Oracle — Knowledge Q&A

### Instructions
When answering questions:
1. Provide accurate, well-structured answers
2. Cite sources when possible (use web_search if needed)
3. Distinguish between facts and opinions
4. If uncertain, clearly state the confidence level
5. Suggest follow-up questions

### Format
**Answer**: [concise response]
**Details**: [expanded explanation]
**Sources**: [references if available]
**Confidence**: High/Medium/Low`,
    },
    'rss-reader': {
        description: 'Read and monitor RSS/Atom feeds',
        content: `---
name: rss-reader
description: Subscribe to and read RSS/Atom feeds from any website
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
---
## RSS Feed Reader

### Operations
- **Read feed**: Fetch the RSS/Atom URL and parse XML
- **Common feeds**: /feed, /rss, /atom.xml, /feed.xml
- **Parse**: Extract title, link, description, pubDate from each item
- **Auto-discover**: Check page HTML for <link rel="alternate" type="application/rss+xml">

### Presentation
Show latest 10 items with: title, date, 1-line summary, link`,
    },
    'blog-watcher': {
        description: 'Monitor websites for content changes',
        content: `---
name: blog-watcher
description: Monitor web pages for new content and changes
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
---
## Blog/Site Watcher

### Instructions
1. Fetch the target URL periodically (use cron tool for scheduling)
2. Compare content hash with previous version
3. If changed, extract new content and notify user
4. Store previous hash in agent memory

### Workflow
- Use web_fetch to get page content
- Calculate content hash with key elements (titles, article count)
- If different from stored hash, report changes
- Use cron tool to schedule periodic checks`,
    },
    'url-shortener': {
        description: 'Create and manage short URLs',
        content: `---
name: url-shortener
description: Create short URLs using various shortener APIs
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
---
## URL Shortener

### Services
- **TinyURL**: GET https://tinyurl.com/api-create.php?url={long_url}
- **is.gd**: GET https://is.gd/create.php?format=simple&url={long_url}
- **v.gd**: GET https://v.gd/create.php?format=simple&url={long_url}

### No API key required for basic shortening`,
    },
    'camsnap': {
        description: 'Capture screenshots and camera photos (macOS)',
        content: `---
name: camsnap
description: Capture screenshots, camera photos, and screen recordings on macOS
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "darwin"}
---
## Camera & Screenshot (macOS)

### Operations
- **Screenshot (full)**: screencapture ~/Desktop/screenshot.png
- **Screenshot (area)**: screencapture -i ~/Desktop/area.png
- **Screenshot (window)**: screencapture -w ~/Desktop/window.png
- **Camera photo**: imagesnap ~/Desktop/photo.jpg (requires imagesnap: brew install imagesnap)
- **Screen record**: screencapture -v ~/Desktop/recording.mov
- **Clipboard**: screencapture -c (copy to clipboard)`,
    },
    'finder': {
        description: 'Interact with macOS Finder',
        content: `---
name: finder
description: Control macOS Finder — open folders, get selections, manage files
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"platform": "darwin"}
---
## macOS Finder Controller

### Operations
- **Open folder**: open /path/to/folder
- **Reveal file**: open -R /path/to/file
- **Get selection**: osascript -e 'tell application "Finder" to get POSIX path of (selection as alias)'
- **Get front folder**: osascript -e 'tell application "Finder" to get POSIX path of (target of front Finder window as alias)'
- **Trash file**: osascript -e 'tell application "Finder" to delete POSIX file "/path/to/file"'
- **Create folder**: mkdir -p /path/to/new/folder`,
    },
    'gif-search': {
        description: 'Search and download GIFs from Giphy/Tenor',
        content: `---
name: gif-search
description: Search for GIFs using Giphy or Tenor API
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "GIPHY_API_KEY"}
---
## GIF Search

### Giphy API
- **Search**: GET https://api.giphy.com/v1/gifs/search?api_key=$GIPHY_API_KEY&q={query}&limit=5
- **Trending**: GET https://api.giphy.com/v1/gifs/trending?api_key=$GIPHY_API_KEY&limit=5
- **Random**: GET https://api.giphy.com/v1/gifs/random?api_key=$GIPHY_API_KEY&tag={tag}

### Response: Return the URL from images.downsized.url`,
    },
    'video-frames': {
        description: 'Extract frames and thumbnails from videos',
        content: `---
name: video-frames
description: Extract frames, thumbnails, and keyframes from video files
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Video Frame Extractor (requires ffmpeg)

### Operations
- **Single frame**: ffmpeg -i video.mp4 -ss 00:00:05 -frames:v 1 frame.jpg
- **Thumbnail grid**: ffmpeg -i video.mp4 -vf "select=not(mod(n\\,100)),scale=320:-1,tile=4x4" grid.jpg
- **Every N seconds**: ffmpeg -i video.mp4 -vf "fps=1/5" frames_%04d.jpg
- **Keyframes**: ffmpeg -i video.mp4 -vf "select=eq(pict_type\\,I)" -vsync vfr keyframes_%04d.jpg
- **GIF from clip**: ffmpeg -i video.mp4 -ss 5 -t 3 -vf "fps=10,scale=320:-1" clip.gif`,
    },
    'pdf-reader': {
        description: 'Extract text and data from PDF files',
        content: `---
name: pdf-reader
description: Read, extract text, and parse PDF documents
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## PDF Reader

### Operations (using built-in tools)
- **Extract text**: pdftotext input.pdf - (pipe to stdout)
- **Page count**: pdfinfo input.pdf | grep Pages
- **Extract page range**: pdftotext -f 1 -l 5 input.pdf -
- **Convert to images**: pdftoppm -png input.pdf output

### macOS alternative
- **Preview text**: mdimport -d2 input.pdf 2>&1
- **Quick Look**: qlmanage -p input.pdf`,
    },
    'email': {
        description: 'Send and read emails via SMTP/IMAP',
        content: `---
name: email
description: Send emails via SMTP and read via IMAP
user-invocable: true
command-dispatch: tool
command-tool: exec
metadata: {"primaryEnv": "EMAIL_ADDRESS", "secondaryEnv": "EMAIL_PASSWORD"}
---
## Email Manager

### Send (using curl SMTP)
curl --ssl-reqd --url "smtps://smtp.gmail.com:465" \\
  --user "$EMAIL_ADDRESS:$EMAIL_PASSWORD" \\
  --mail-from "$EMAIL_ADDRESS" \\
  --mail-rcpt "recipient@example.com" \\
  -T email.txt

### Read (himalaya CLI recommended)
- **List inbox**: himalaya list --account default
- **Read message**: himalaya read {id}
- **Search**: himalaya search "keyword"

### SECURITY
- Use app-specific passwords, never main password
- Store credentials in config.json, never in commands`,
    },
    'healthcheck': {
        description: 'Monitor URL uptime and response times',
        content: `---
name: healthcheck
description: Monitor website uptime, response time, and SSL status
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
---
## Health Check Monitor

### Check a URL
1. Fetch the URL with web_fetch
2. Record: status code, response time, content hash
3. Check SSL certificate expiry if HTTPS

### Reporting Format
- **URL**: {url}
- **Status**: {code} ({ok/error})
- **Response Time**: {ms}ms
- **SSL Expiry**: {date} ({days} days remaining)

### Use with cron tool for periodic monitoring`,
    },
    'session-logs': {
        description: 'View and search conversation session logs',
        content: `---
name: session-logs
description: Browse, search, and export conversation session logs
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Session Log Manager

### Storage: ~/.coreblow/agents/default/sessions/

### Operations
- **List sessions**: ls -la ~/.coreblow/agents/default/sessions/
- **View session**: cat ~/.coreblow/agents/default/sessions/{id}.jsonl
- **Search**: grep -rl "keyword" ~/.coreblow/agents/default/sessions/
- **Count messages**: wc -l ~/.coreblow/agents/default/sessions/{id}.jsonl
- **Export**: cp session.jsonl ~/Desktop/export.jsonl
- **Clear old**: find sessions/ -mtime +30 -delete`,
    },
    'model-usage': {
        description: 'Track AI model token usage and costs',
        content: `---
name: model-usage
description: Track token usage, costs, and performance across all AI providers
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Model Usage Tracker

### Storage: ~/.coreblow/usage/

### Metrics tracked per request
- Provider name, model name
- Prompt tokens, completion tokens
- Response time (ms)
- Estimated cost (USD)

### Reports
- **Daily summary**: Token count, cost, requests per provider
- **Top models**: Most used models by token count
- **Cost estimate**: Based on provider pricing`,
    },
    'skill-creator': {
        description: 'Create new skills from templates',
        content: `---
name: skill-creator
description: Generate new SKILL.md files from templates and natural language
user-invocable: true
command-dispatch: prompt
---
## Skill Creator

### Instructions
When asked to create a new skill:
1. Ask for: name, description, what tool it uses (exec, web_fetch, prompt)
2. Ask for API details if web-based
3. Generate proper SKILL.md with frontmatter
4. Save to ~/.coreblow/skills/{name}/SKILL.md

### Template
---
name: {name}
description: {description}
user-invocable: true
command-dispatch: tool
command-tool: {tool}
metadata: {env_requirements}
---
## {Title}
{Instructions for the AI on how to use this skill}`,
    },
    'discord-rich': {
        description: 'Discord rich interactions — embeds, reactions, threads',
        content: `---
name: discord-rich
description: Advanced Discord features — embeds, reactions, threads, slash commands
homepage: https://discord.com
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "DISCORD_BOT_TOKEN"}
---
## Discord Rich Interactions

### Headers
- Authorization: Bot $DISCORD_BOT_TOKEN
- Content-Type: application/json

### API Base: https://discord.com/api/v10

### Operations
- **Send embed**: POST /channels/{id}/messages with {"embeds": [{...}]}
- **Add reaction**: PUT /channels/{id}/messages/{msg}/reactions/{emoji}/@me
- **Create thread**: POST /channels/{id}/threads with {"name": "Thread", "type": 11}
- **Pin message**: PUT /channels/{id}/pins/{msg}
- **Edit message**: PATCH /channels/{id}/messages/{msg}`,
    },
    'telegram-rich': {
        description: 'Telegram rich interactions — inline keyboards, media groups',
        content: `---
name: telegram-rich
description: Advanced Telegram features — inline keyboards, stickers, polls, media
user-invocable: true
command-dispatch: tool
command-tool: web_fetch
metadata: {"primaryEnv": "TELEGRAM_BOT_TOKEN"}
---
## Telegram Rich Interactions

### API Base: https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN

### Operations
- **Inline keyboard**: POST /sendMessage with reply_markup.inline_keyboard
- **Send photo**: POST /sendPhoto with chat_id and photo URL
- **Send poll**: POST /sendPoll with question and options array
- **Send sticker**: POST /sendSticker with sticker file_id
- **Edit message**: POST /editMessageText
- **Pin message**: POST /pinChatMessage`,
    },
    'clipboard': {
        description: 'Access system clipboard (read/write)',
        content: `---
name: clipboard
description: Read from and write to the system clipboard
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Clipboard Manager

### macOS
- **Read**: pbpaste
- **Write**: echo "text" | pbcopy
- **Write file contents**: pbcopy < file.txt

### Linux (xclip)
- **Read**: xclip -selection clipboard -o
- **Write**: echo "text" | xclip -selection clipboard

### Clipboard is useful for transferring data between skills`,
    },
    'crontab': {
        description: 'Manage system crontab entries',
        content: `---
name: crontab
description: View and manage system cron jobs
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Crontab Manager

### Operations
- **List jobs**: crontab -l
- **Edit**: crontab -e (non-interactive: pipe new crontab)
- **Add job**: (crontab -l 2>/dev/null; echo "0 * * * * /path/to/command") | crontab -

### Cron Format: minute hour day month weekday command
- Every hour: 0 * * * *
- Daily at 9AM: 0 9 * * *
- Every 5 min: */5 * * * *
- Weekdays only: 0 9 * * 1-5`,
    },
    'network': {
        description: 'Network diagnostics and monitoring',
        content: `---
name: network
description: Network diagnostics — ping, DNS, port scan, bandwidth
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Network Diagnostics

### Operations
- **Ping**: ping -c 4 {host}
- **DNS lookup**: nslookup {domain} or dig {domain}
- **Port check**: nc -zv {host} {port}
- **Traceroute**: traceroute {host}
- **Local IP**: ifconfig | grep "inet " or ip addr
- **Public IP**: curl -s ifconfig.me
- **Speed test**: curl -o /dev/null -w "%{speed_download}" https://speed.cloudflare.com/__down?bytes=10000000
- **Open ports**: lsof -i -P -n | grep LISTEN`,
    },
    'process-manager': {
        description: 'Monitor and manage system processes',
        content: `---
name: process-manager
description: View, monitor, and manage running system processes
user-invocable: true
command-dispatch: tool
command-tool: exec
---
## Process Manager

### Operations
- **List top**: top -l 1 -n 10 (macOS) or top -bn1 | head -20 (Linux)
- **Find process**: ps aux | grep {name}
- **Kill process**: kill {pid} or kill -9 {pid}
- **Memory usage**: ps aux --sort=-%mem | head -10
- **CPU usage**: ps aux --sort=-%cpu | head -10
- **Disk usage**: df -h
- **Port in use**: lsof -i :{port}`,
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
