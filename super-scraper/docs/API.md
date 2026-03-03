# Super Scraper v2 — API Reference

## Base URL

```
https://super-scraper-worker.<your-account>.workers.dev
```

## Authentication

All API requests require authentication via one of:

| Method | Header | Example |
|:---|:---|:---|
| API Key | `X-API-Key: <key>` | `X-API-Key: ss_VFL...` |
| Bearer Token | `Authorization: Bearer <jwt>` | `Authorization: Bearer eyJ...` |
| Master Key | `X-Master-Key: <key>` | Initial setup only |

---

## Endpoints

### Health Check

```
GET /api/health
```

No authentication required. Returns:
```json
{"status": "ok", "version": "2.0.0", "engine": "CoreBlow Super Scraper"}
```

### Stats

```
GET /api/stats
```

Returns dashboard statistics (target count, job count, success rate, etc.)

---

### Targets

#### List Targets
```
GET /api/targets?page=1&limit=20
```

#### Get Target
```
GET /api/targets/:id
```

#### Create Target
```
POST /api/targets
Content-Type: application/json

{
  "name": "Example Site",
  "url": "https://example.com",
  "selectors": "{\"title\": \"h1\", \"content\": \"p\"}",
  "selector_type": "css",
  "schedule": "0 */6 * * *",
  "proxy_required": 0,
  "screenshot_enabled": 0
}
```

#### Update Target
```
PUT /api/targets/:id
Content-Type: application/json

{ "name": "Updated Name" }
```

#### Delete Target
```
DELETE /api/targets/:id
```

---

### Jobs

#### List Jobs
```
GET /api/jobs?status=pending&page=1&limit=20
```

Status values: `pending`, `running`, `success`, `failed`, `cancelled`

#### Get Pending Jobs
```
GET /api/jobs/pending
```

Used by the scraper engine to fetch work.

#### Create Job
```
POST /api/jobs
Content-Type: application/json

{ "target_id": 1 }
```

#### Update Job
```
PUT /api/jobs/:id
Content-Type: application/json

{ "status": "running", "started_at": "2026-01-01T00:00:00Z" }
```

#### Cancel Job
```
PUT /api/jobs/:id
Content-Type: application/json

{ "status": "cancelled" }
```

#### Retry Job
```
PUT /api/jobs/:id
Content-Type: application/json

{ "status": "pending" }
```

---

### Data

#### List Data
```
GET /api/data?target_id=1&search=keyword&page=1&limit=20
```

#### Get Data Record
```
GET /api/data/:id
```

#### Store Data
```
POST /api/data
Content-Type: application/json

{
  "target_id": 1,
  "url": "https://example.com",
  "title": "Example",
  "content": "<html>...</html>",
  "extracted_data": {"title": "Example Domain"},
  "status": "success",
  "content_hash": "abc123"
}
```

---

### Export

#### Export Data
```
GET /api/export?format=csv&target_id=1&limit=1000
```

Formats: `csv`, `json`

---

### Auth

#### Initial Setup (Master Key only)
```
POST /api/auth/setup
X-Master-Key: <master_key>
Content-Type: application/json

{ "name": "Admin Key" }
```

Returns a new API key.

#### Generate API Key
```
POST /api/auth/keys
Content-Type: application/json

{ "name": "Dashboard Key" }
```

---

## Rate Limits

- 60 requests per minute per IP
- HTTP 429 returned when exceeded

## Error Responses

```json
{
  "success": false,
  "error": "Error message description"
}
```

| Status | Meaning |
|:---|:---|
| 400 | Bad Request — invalid input |
| 401 | Unauthorized — missing/invalid auth |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |
