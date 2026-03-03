# CoreBlow Gateway — API Reference

## Base URL

Default: `http://127.0.0.1:3577`

## Authentication

Include the token in the Authorization header:
```
Authorization: Bearer <your-token>
```

---

## Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2026-04-05T19:00:00Z"
}
```

---

### Chat Completions

```
POST /v1/chat/completions
```

**Request Body (validated by Zod):**
```json
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 8192,
  "stream": false,
  "tools": []
}
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "model": "anthropic/claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help?" },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  }
}
```

---

### Sessions

#### Create Session
```
POST /v1/sessions
```

**Request:**
```json
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "workspace": "/path/to/workspace",
  "systemPrompt": "You are a coding assistant.",
  "metadata": {}
}
```

#### Get Session
```
GET /v1/sessions/:id
```

#### List Sessions
```
GET /v1/sessions
```

#### Delete Session
```
DELETE /v1/sessions/:id
```

---

### Exec Approval

```
POST /v1/exec-approval
```

**Request:**
```json
{
  "sessionId": "session-123",
  "command": "npm test",
  "approved": true
}
```

---

### Cron Jobs

#### Create Cron
```
POST /v1/cron
```

**Request:**
```json
{
  "name": "daily-summary",
  "schedule": "0 9 * * *",
  "prompt": "Summarize today's activity",
  "active": true
}
```

#### List Crons
```
GET /v1/cron
```

#### Delete Cron
```
DELETE /v1/cron/:id
```

---

## Error Handling

All errors follow this format:
```json
{
  "error": {
    "type": "validation_error",
    "message": "Invalid model parameter",
    "details": [
      { "path": "model", "message": "must be a non-empty string" }
    ]
  }
}
```

**Error Types:**
| Type | HTTP Code | Description |
|------|-----------|-------------|
| `validation_error` | 400 | Request body fails Zod validation |
| `auth_error` | 401 | Missing or invalid authentication |
| `forbidden` | 403 | Insufficient RBAC permissions |
| `not_found` | 404 | Resource not found |
| `rate_limited` | 429 | Token bucket exhausted |
| `internal_error` | 500 | Unexpected server error |

## WebSocket API

```
ws://127.0.0.1:3577/ws
```

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `message` | Client → Server | Send user message |
| `response` | Server → Client | Assistant response chunk |
| `tool_use` | Server → Client | Tool execution notification |
| `tool_result` | Server → Client | Tool execution result |
| `error` | Server → Client | Error event |
| `heartbeat` | Both | Connection keepalive |

### Message Format

```json
{
  "type": "message",
  "sessionId": "session-123",
  "data": {
    "content": "Hello, assistant!"
  }
}
```
