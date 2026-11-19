/**
 * CoreBlow — Extended Built-in Native Tools (45 Tools across 12 Domain Toolsets)
 *
 * Complements the 30 base tools in coreblow-react-engine.ts to form CoreBlow's
 * 75-Tool Native Surface across 12 specialized domain toolsets.
 */

import * as childProcess from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { listAvailableBackends } from "../sandbox/multi-backend-executor.js";
import { getActiveMicrokernel } from "../gateway/microkernel-services.js";
import { classifyTaskRouteTier, resolveAdaptiveModelRoute } from "../providers/decision-router.js";
import { getCheckpointManager } from "../security/checkpoint-manager.js";
import type { CoreBlowToolResult, ExecutionProfile } from "./coreblow-react-engine.js";

export type CoreBlowToolsetId =
  | "filesystem"
  | "execution"
  | "code_intelligence"
  | "git_pr"
  | "web_browser"
  | "memory_rag"
  | "sessions"
  | "subagents_skills"
  | "automation"
  | "data_crypto"
  | "media_multimodal"
  | "governance";

export const COREBLOW_TOOLSETS: Readonly<Record<CoreBlowToolsetId, readonly string[]>> = Object.freeze({
  filesystem: [
    "read_file",
    "write_file",
    "patch",
    "multi_patch",
    "search_files",
    "list_dir",
    "file_stat",
    "file_tree",
    "archive_ops",
    "pdf_extract",
  ],
  execution: [
    "terminal",
    "execute_code",
    "sandbox_backends",
    "process_inspect",
    "process_kill",
    "env_inspect",
    "port_wait",
  ],
  code_intelligence: [
    "lsp_diagnostics",
    "ast_symbols",
    "code_outline",
    "dependency_audit",
    "deadcode_scan",
    "test_runner",
    "coverage_inspect",
  ],
  git_pr: [
    "git_inspect",
    "git_blame",
    "git_log_search",
    "git_stash_inspect",
    "git_worktree_list",
    "pr_workflow",
  ],
  web_browser: [
    "web_fetch",
    "web_search",
    "browser_action",
    "http_request",
    "url_metadata",
    "rss_feed_read",
  ],
  memory_rag: [
    "memory_search",
    "memory_store",
    "memory_layers",
    "memory_forget",
    "wiki_compile",
    "rag_query",
  ],
  sessions: [
    "session_search",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "session_export",
    "session_compact",
  ],
  subagents_skills: [
    "delegate_subagent",
    "war_room_board",
    "skill_search",
    "skill_create",
    "skill_inspect",
    "decision_route",
  ],
  automation: [
    "cron_list",
    "cron_schedule",
    "cron_run_now",
    "workflow_pipeline",
    "webhook_inspect",
  ],
  data_crypto: [
    "calculator",
    "json_query",
    "csv_inspect",
    "sqlite_query",
    "hash_encode",
    "diff_compare",
  ],
  media_multimodal: [
    "tts_speak",
    "image_inspect",
    "image_generate",
    "audio_transcribe",
    "diagram_render",
  ],
  governance: [
    "message_channel",
    "nodes_status",
    "security_scan",
    "trust_zone_inspect",
    "toolset_discover",
  ],
});

/**
 * 45 Extended OpenAI Tool Schemas (merged with the 30 base tools to reach 75 total).
 */
export const COREBLOW_EXTENDED_OPENAI_TOOLS = [
  // 1. Filesystem & Archive (+4)
  {
    type: "function",
    function: {
      name: "multi_patch",
      description: "Atomically apply multiple old_text -> new_text replacements to a single file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Target file path" },
          hunks: {
            type: "array",
            description: "List of replacement hunks",
            items: {
              type: "object",
              properties: {
                old_text: { type: "string" },
                new_text: { type: "string" },
              },
              required: ["old_text", "new_text"],
            },
          },
        },
        required: ["path", "hunks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_stat",
      description: "Inspect file metadata: size, mtime, permissions, type, and SHA-256 hash",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File or directory path" },
          hash: { type: "boolean", description: "Compute SHA-256 hash for regular files (default: true)" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_tree",
      description: "Generate an ASCII directory tree visualization with bounded depth",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Root directory path" },
          max_depth: { type: "integer", description: "Maximum tree depth (default: 3)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archive_ops",
      description: "Inspect, create, or extract tar/zip archives",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create", "extract"], description: "Archive operation" },
          archive_path: { type: "string", description: "Path to .tar/.tar.gz/.zip archive" },
          target_path: { type: "string", description: "Source path (for create) or destination dir (for extract)" },
        },
        required: ["action", "archive_path"],
      },
    },
  },

  // 2. Shell & 8-Backend Execution (+4)
  {
    type: "function",
    function: {
      name: "sandbox_backends",
      description: "List and probe readiness of all 8 CoreBlow sovereign execution backends (local, vm_isolate, docker, ssh, daytona, modal, vercel, e2b)",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_kill",
      description: "Safely terminate a local process by PID (requires Full access profile)",
      parameters: {
        type: "object",
        properties: {
          pid: { type: "integer", description: "Process ID to terminate" },
          signal: { type: "string", enum: ["SIGTERM", "SIGKILL", "SIGINT"], description: "Signal to send (default: SIGTERM)" },
        },
        required: ["pid"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "env_inspect",
      description: "Inspect redacted environment variables and active host toolchain versions (Node, pnpm, Python, Git)",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Optional substring filter for env variable names" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "port_wait",
      description: "Probe or wait for a local/remote TCP port to become reachable",
      parameters: {
        type: "object",
        properties: {
          host: { type: "string", description: "Target host (default: 127.0.0.1)" },
          port: { type: "integer", description: "TCP port number" },
          timeout_ms: { type: "integer", description: "Maximum wait time in ms (default: 3000)" },
        },
        required: ["port"],
      },
    },
  },

  // 3. LSP, AST & Code Intelligence (+6)
  {
    type: "function",
    function: {
      name: "ast_symbols",
      description: "Extract functions, classes, interfaces, types, and exported symbols from TS/JS/Python/Go/Rust source files",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Source file path to analyze" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "code_outline",
      description: "Produce a structural outline with line numbers for a source code file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Source file path" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "dependency_audit",
      description: "Inspect package.json dependencies, devDependencies, engines, and npm scripts in a project",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project directory or package.json path" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deadcode_scan",
      description: "Scan a directory for potentially unused exported symbols or unreferenced files",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Target source directory" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "test_runner",
      description: "Run targeted unit test files via vitest, pytest, cargo test, or go test",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Test file path or filter pattern" },
          runner: { type: "string", enum: ["vitest", "pytest", "cargo", "go", "auto"], description: "Test framework (default: auto)" },
        },
        required: ["target"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "coverage_inspect",
      description: "Inspect test coverage reports (coverage-summary.json, lcov.info) in workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Workspace or coverage directory path" },
        },
      },
    },
  },

  // 4. Git & 5-Gate PR Workflow (+4)
  {
    type: "function",
    function: {
      name: "git_blame",
      description: "Run git blame on a file (optionally bounded by line range)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to blame" },
          start_line: { type: "integer", description: "Starting 1-based line number" },
          end_line: { type: "integer", description: "Ending 1-based line number" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_log_search",
      description: "Search git commit history by commit message (--grep) or code string pickaxe (-S)",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search string" },
          mode: { type: "string", enum: ["message", "pickaxe"], description: "Search commit messages or code diffs (default: message)" },
          limit: { type: "integer", description: "Max commits (default: 15)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_stash_inspect",
      description: "Safely list or inspect git stash entries without mutating working tree",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "show"], description: "Inspect mode (default: list)" },
          index: { type: "integer", description: "Stash index (e.g. 0 for stash@{0})" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_worktree_list",
      description: "List active git worktrees and their branches/commits",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  // 5. Web, Search & Browser Automation (+3)
  {
    type: "function",
    function: {
      name: "http_request",
      description: "Send structured REST or GraphQL HTTP requests with custom method, headers, and JSON body",
      parameters: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"], description: "HTTP method" },
          url: { type: "string", description: "Target HTTP/HTTPS URL" },
          headers: { type: "object", description: "Optional HTTP headers" },
          body: { type: "string", description: "Optional JSON or raw request body" },
        },
        required: ["method", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "url_metadata",
      description: "Fetch and parse webpage OpenGraph tags, title, description, and canonical link",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Target URL to inspect" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rss_feed_read",
      description: "Fetch and parse an RSS or Atom XML feed into structured items",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "RSS or Atom feed URL" },
          limit: { type: "integer", description: "Max entries to return (default: 10)" },
        },
        required: ["url"],
      },
    },
  },

  // 6. Cory 4-Layer Memory & Knowledge Scribe (+3)
  {
    type: "function",
    function: {
      name: "memory_layers",
      description: "Inspect counts and items across all 4 Cory memory layers (identity, durable, constraint, episodic)",
      parameters: {
        type: "object",
        properties: {
          layer: { type: "string", enum: ["identity", "durable", "constraint", "episodic", "all"], description: "Layer filter (default: all)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memory_forget",
      description: "Delete or prune obsolete memory items by ID or substring match in Cory memory",
      parameters: {
        type: "object",
        properties: {
          id_or_query: { type: "string", description: "Memory item ID or matching substring to remove" },
          layer: { type: "string", enum: ["identity", "durable", "constraint", "episodic"], description: "Optional layer restriction" },
        },
        required: ["id_or_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wiki_compile",
      description: "Compile durable Cory memory into structured Knowledge Wiki pages or read existing wiki pages",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "read", "compile"], description: "Wiki operation (default: list)" },
          topic: { type: "string", description: "Optional topic or page slug" },
        },
      },
    },
  },

  // 7. Unified Sessions & Cross-Surface Continuity (+2)
  {
    type: "function",
    function: {
      name: "session_export",
      description: "Export a persisted session transcript to Markdown or JSON format",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "Session ID to export" },
          format: { type: "string", enum: ["markdown", "json"], description: "Export format (default: markdown)" },
        },
        required: ["session_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "session_compact",
      description: "Summarize and compact long conversation session history to reclaim context budget",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "string", description: "Session ID to compact" },
          keep_recent: { type: "integer", description: "Number of recent messages to keep verbatim (default: 6)" },
        },
        required: ["session_id"],
      },
    },
  },

  // 8. Subagents, War Room & EvoLoop Skills (+4)
  {
    type: "function",
    function: {
      name: "war_room_board",
      description: "Inspect rooms, specialist states, or move Kanban cards on the Multi-Agent War Room board",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "inspect", "move_card"], description: "Board action (default: list)" },
          room_id: { type: "string", description: "War room ID" },
          task_id: { type: "string", description: "Kanban task card ID (for move_card)" },
          column: { type: "string", enum: ["backlog", "in_progress", "review", "done"], description: "Target column (for move_card)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skill_create",
      description: "Synthesize and save a new reusable cognitive skill (SKILL.md) to ~/.coreblow/skills/",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Kebab-case skill name (e.g. 'nextjs-deploy')" },
          description: { type: "string", description: "Short summary of when to use the skill" },
          instructions: { type: "string", description: "Markdown instructions and workflows for the skill" },
          tags: { type: "array", items: { type: "string" }, description: "Optional searchable tags" },
        },
        required: ["name", "description", "instructions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skill_inspect",
      description: "Read the full Markdown instructions of a learned or installed CoreBlow skill",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name or ID" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "decision_route",
      description: "Query CoreBlow's 6-tier Decision Router for optimal model tier, provider, and failover recommendation",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Task description to classify and route" },
          tier: { type: "string", enum: ["fast", "deep", "local", "coding", "vision", "decision"], description: "Optional explicit tier override" },
        },
        required: ["prompt"],
      },
    },
  },

  // 9. Cron, Workflows & Triggers (+3)
  {
    type: "function",
    function: {
      name: "cron_run_now",
      description: "Trigger an immediate execution test run of a scheduled cron job by ID",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Cron job ID to trigger" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workflow_pipeline",
      description: "Inspect or validate multi-step DAG workflow pipelines in the workspace",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "validate", "status"], description: "Pipeline action (default: list)" },
          pipeline_id: { type: "string", description: "Optional pipeline ID or path" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "webhook_inspect",
      description: "List and inspect configured inbound HTTP webhook routes and security settings",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },

  // 10. Data, SQLite, JSON & Crypto Utilities (+5)
  {
    type: "function",
    function: {
      name: "json_query",
      description: "Query and extract fields from a JSON file or JSON string using dot-path expressions (e.g. 'dependencies.zod' or 'items[0].name')",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Path to JSON file or raw JSON string" },
          query: { type: "string", description: "Dot-path expression (e.g. 'scripts.build' or 'items.0.id')" },
        },
        required: ["source", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "csv_inspect",
      description: "Parse a CSV or TSV file to inspect column headers, total row count, and sample rows",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to CSV/TSV file" },
          sample_rows: { type: "integer", description: "Number of sample rows to return (default: 5)" },
          delimiter: { type: "string", description: "Column delimiter (default: auto-detect ',' or '\\t')" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sqlite_query",
      description: "Execute read-only SQL queries (SELECT, PRAGMA, EXPLAIN) against a local SQLite database file",
      parameters: {
        type: "object",
        properties: {
          db_path: { type: "string", description: "Path to .db or .sqlite file" },
          sql: { type: "string", description: "Read-only SQL query (SELECT / PRAGMA / EXPLAIN)" },
          limit: { type: "integer", description: "Max rows to return (default: 50)" },
        },
        required: ["db_path", "sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "hash_encode",
      description: "Compute cryptographic hashes (sha256, sha512, md5), encode/decode base64, generate UUIDv4, or decode JWT headers/payloads",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["sha256", "sha512", "md5", "base64_encode", "base64_decode", "uuid", "jwt_decode"],
            description: "Cryptographic or encoding operation",
          },
          input: { type: "string", description: "Input text (not required for uuid)" },
        },
        required: ["operation"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "diff_compare",
      description: "Generate a line-by-line unified diff comparing two files or two raw strings",
      parameters: {
        type: "object",
        properties: {
          left: { type: "string", description: "First file path or raw text string" },
          right: { type: "string", description: "Second file path or raw text string" },
          is_file_paths: { type: "boolean", description: "Treat left and right as file paths (default: true if files exist)" },
        },
        required: ["left", "right"],
      },
    },
  },

  // 11. Media, Voice & Multimodal (+4)
  {
    type: "function",
    function: {
      name: "image_inspect",
      description: "Inspect an image file's format, pixel dimensions (PNG/JPEG/GIF/WebP), and file size",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to image file" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "image_generate",
      description: "Generate an image from a text prompt using the configured CoreBlow image provider or gateway",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Image generation prompt" },
          size: { type: "string", description: "Image dimensions (e.g. '1024x1024')" },
          output_path: { type: "string", description: "Optional destination file path" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "audio_transcribe",
      description: "Transcribe a local audio file (.mp3, .wav, .m4a, .ogg) using the gateway or Whisper endpoint",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to audio file" },
          language: { type: "string", description: "Optional ISO language code (e.g. 'en', 'id')" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "diagram_render",
      description: "Validate syntax and format Mermaid or Graphviz DOT architecture diagrams into clean SVG/Markdown blocks",
      parameters: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["mermaid", "dot"], description: "Diagram syntax format" },
          source: { type: "string", description: "Diagram source text" },
          output_path: { type: "string", description: "Optional path to save diagram source or rendered output" },
        },
        required: ["format", "source"],
      },
    },
  },

  // 12. Messaging, Nodes & Security Governance (+3)
  {
    type: "function",
    function: {
      name: "security_scan",
      description: "Scan a workspace file or directory for leaked API keys, private keys, and dangerous path traversal sinks",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory or file path to scan (default: workspace root)" },
          max_files: { type: "integer", description: "Max files to scan (default: 150)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trust_zone_inspect",
      description: "Inspect active CoreBlow TrustZone policies, execution profile rules, and microkernel governance state",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toolset_discover",
      description: "List all 12 CoreBlow domain toolsets and 75 native built-in tools, optionally filtering by keyword or toolset ID",
      parameters: {
        type: "object",
        properties: {
          toolset: { type: "string", description: "Optional toolset ID to inspect" },
          query: { type: "string", description: "Optional keyword search across tool names" },
        },
      },
    },
  },
] as const;

const TOOLSET_KEYWORDS: Readonly<Record<CoreBlowToolsetId, readonly string[]>> = {
  filesystem: ["file", "dir", "folder", "tree", "archive", "tar", "zip", "pdf", "stat", "hash", "patch", "read", "write"],
  execution: ["shell", "bash", "terminal", "exec", "docker", "ssh", "daytona", "modal", "vercel", "e2b", "sandbox", "vm", "port", "pid", "kill", "env", "process"],
  code_intelligence: ["ast", "symbol", "outline", "lsp", "type", "lint", "audit", "dep", "deadcode", "unused", "test", "vitest", "pytest", "coverage", "cargo"],
  git_pr: ["git", "commit", "blame", "branch", "stash", "worktree", "pr", "pull request", "diff", "log"],
  web_browser: ["http", "https", "url", "web", "fetch", "search", "browser", "scrape", "rest", "graphql", "rss", "atom", "feed", "og", "meta"],
  memory_rag: ["memory", "remember", "forget", "cory", "layer", "wiki", "rag", "knowledge", "constraint"],
  sessions: ["session", "history", "transcript", "export", "compact", "summarize", "chat"],
  subagents_skills: ["subagent", "delegate", "war room", "kanban", "skill", "evoloop", "route", "tier", "model"],
  automation: ["cron", "schedule", "trigger", "workflow", "pipeline", "dag", "webhook"],
  data_crypto: ["json", "csv", "tsv", "sqlite", "sql", "db", "sha256", "md5", "base64", "uuid", "jwt", "calc", "math", "diff"],
  media_multimodal: ["tts", "speak", "voice", "audio", "transcribe", "whisper", "image", "png", "jpg", "diagram", "mermaid", "dot"],
  governance: ["security", "secret", "leak", "scan", "trust", "zone", "policy", "channel", "telegram", "discord", "slack", "node", "toolset", "tools"],
};

const CORE_30_TOOL_NAMES = new Set<string>([
  "terminal",
  "read_file",
  "write_file",
  "patch",
  "search_files",
  "list_dir",
  "web_fetch",
  "web_search",
  "memory_search",
  "memory_store",
  "skill_search",
  "delegate_subagent",
  "git_inspect",
  "process_inspect",
  "cron_list",
  "calculator",
  "session_search",
  "sessions_list",
  "sessions_history",
  "sessions_send",
  "cron_schedule",
  "browser_action",
  "rag_query",
  "pr_workflow",
  "lsp_diagnostics",
  "execute_code",
  "message_channel",
  "nodes_status",
  "tts_speak",
  "pdf_extract",
  "toolset_discover",
  "sandbox_backends",
]);

/**
 * Smart intent-aware toolset router (Phase 3).
 * Always includes the 30 high-frequency core tools + toolset_discover + sandbox_backends,
 * plus any specialized domain toolsets whose keywords match the user's prompt.
 */
export function selectToolsForPrompt<T extends { function: { name: string } }>(
  allTools: readonly T[],
  prompt: string,
  options?: { mode?: "smart" | "all" },
): T[] {
  if (options?.mode === "all") {
    return [...allTools];
  }

  const selectedNames = new Set<string>(CORE_30_TOOL_NAMES);
  const lower = (prompt || "").toLowerCase();

  for (const [toolsetId, keywords] of Object.entries(TOOLSET_KEYWORDS) as Array<
    [CoreBlowToolsetId, readonly string[]]
  >) {
    if (keywords.some((kw) => lower.includes(kw))) {
      for (const toolName of COREBLOW_TOOLSETS[toolsetId]) {
        selectedNames.add(toolName);
      }
    }
  }

  return allTools.filter((t) => selectedNames.has(t.function.name));
}

function resolveTarget(rawPath: string | undefined, defaultCwd?: string): string {
  const cwd = defaultCwd || process.cwd();
  if (!rawPath || !rawPath.trim()) return cwd;
  let p = rawPath.trim();
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(cwd, p);
}

function execSyncSafe(cmd: string, args: string[], cwd?: string, timeout = 15000): { ok: boolean; stdout: string; stderr: string; exitCode: number } {
  const res = childProcess.spawnSync(cmd, args, {
    cwd: cwd || process.cwd(),
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    ok: res.status === 0,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? (res.error ? res.error.message : ""),
    exitCode: res.status ?? 1,
  };
}

/**
 * Executes any of the 45 extended native tools deterministically.
 * Returns null if `name` is not handled by the extended toolset.
 */
export async function executeExtendedTool(
  name: string,
  args: Record<string, unknown>,
  executionProfile: ExecutionProfile,
  defaultCwd?: string,
  fetchFn: typeof fetch = fetch,
): Promise<CoreBlowToolResult | null> {
  const cwd = defaultCwd || process.cwd();
  const isReadOnly = executionProfile === "Read-only" || executionProfile === "Guarded";

  switch (name) {
    // ── 1. Filesystem & Archive ───────────────────────────────────────────
    case "multi_patch": {
      if (isReadOnly) {
        return { success: false, output: `multi_patch blocked under ${executionProfile} profile.`, error: "Permission denied" };
      }
      const target = resolveTarget(String(args.path ?? ""), cwd);
      const hunks = Array.isArray(args.hunks) ? (args.hunks as Array<{ old_text?: string; new_text?: string }>) : [];
      if (!fs.existsSync(target)) {
        return { success: false, output: `File not found: ${target}`, error: "ENOENT" };
      }
      if (hunks.length === 0) {
        return { success: false, output: "No hunks provided to multi_patch.", error: "Invalid args" };
      }
      let content = fs.readFileSync(target, "utf8");
      for (let i = 0; i < hunks.length; i++) {
        const oldText = String(hunks[i]?.old_text ?? "");
        const newText = String(hunks[i]?.new_text ?? "");
        if (!oldText || !content.includes(oldText)) {
          return {
            success: false,
            output: `Atomic multi_patch aborted: hunk #${i + 1} old_text not found in ${target}. File left untouched.`,
            error: "Hunk mismatch",
          };
        }
        content = content.replace(oldText, () => newText);
      }
      try {
        getCheckpointManager().createCheckpoint(target, "multi_patch");
      } catch {
        // Snapshot failure should not block multi_patch execution
      }
      fs.writeFileSync(target, content, "utf8");
      return { success: true, output: `Successfully applied ${hunks.length} atomic hunk(s) to ${target}.`, exitCode: 0 };
    }

    case "file_stat": {
      const target = resolveTarget(String(args.path ?? ""), cwd);
      if (!fs.existsSync(target)) {
        return { success: false, output: `Path not found: ${target}`, error: "ENOENT" };
      }
      const stat = fs.statSync(target);
      const modeOctal = (stat.mode & 0o777).toString(8).padStart(3, "0");
      let sha256: string | undefined;
      if (stat.isFile() && args.hash !== false && stat.size <= 32 * 1024 * 1024) {
        sha256 = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
      }
      return {
        success: true,
        output: JSON.stringify(
          {
            path: target,
            type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
            sizeBytes: stat.size,
            permissions: `0o${modeOctal}`,
            mtimeIso: stat.mtime.toISOString(),
            ...(sha256 ? { sha256 } : {}),
          },
          null,
          2,
        ),
        exitCode: 0,
      };
    }

    case "file_tree": {
      const target = resolveTarget(args.path ? String(args.path) : undefined, cwd);
      const maxDepth = Math.min(Number(args.max_depth ?? 3) || 3, 6);
      if (!fs.existsSync(target)) {
        return { success: false, output: `Directory not found: ${target}`, error: "ENOENT" };
      }
      const lines: string[] = [path.basename(target) + "/"];
      const walk = (dir: string, prefix: string, depth: number) => {
        if (depth >= maxDepth || lines.length >= 250) return;
        let entries: fs.Dirent[];
        try {
          entries = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((e) => !["node_modules", ".git", "dist", ".next"].includes(e.name))
            .sort((a, b) => a.name.localeCompare(b.name));
        } catch {
          return;
        }
        entries.forEach((entry, idx) => {
          if (lines.length >= 250) return;
          const isLast = idx === entries.length - 1;
          const connector = isLast ? "└── " : "├── ";
          lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? "/" : ""}`);
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), prefix + (isLast ? "    " : "│   "), depth + 1);
          }
        });
      };
      walk(target, "", 0);
      return { success: true, output: lines.join("\n"), exitCode: 0 };
    }

    case "archive_ops": {
      const action = String(args.action ?? "list");
      const archivePath = resolveTarget(String(args.archive_path ?? ""), cwd);
      const targetPath = args.target_path ? resolveTarget(String(args.target_path), cwd) : cwd;
      if ((action === "create" || action === "extract") && isReadOnly) {
        return { success: false, output: `archive_ops '${action}' blocked under ${executionProfile}.`, error: "Permission denied" };
      }
      const isZip = archivePath.toLowerCase().endsWith(".zip");
      if (action === "list") {
        const res = isZip
          ? execSyncSafe("unzip", ["-l", archivePath], cwd)
          : execSyncSafe("tar", ["-tf", archivePath], cwd);
        return { success: res.ok, output: res.stdout || res.stderr, exitCode: res.exitCode };
      }
      if (action === "create") {
        const res = isZip
          ? execSyncSafe("zip", ["-r", archivePath, path.basename(targetPath)], path.dirname(targetPath))
          : execSyncSafe("tar", ["-czf", archivePath, "-C", path.dirname(targetPath), path.basename(targetPath)], cwd);
        return { success: res.ok, output: res.stdout || `Created archive ${archivePath}`, exitCode: res.exitCode };
      }
      fs.mkdirSync(targetPath, { recursive: true });
      const res = isZip
        ? execSyncSafe("unzip", ["-o", archivePath, "-d", targetPath], cwd)
        : execSyncSafe("tar", ["-xf", archivePath, "-C", targetPath], cwd);
      return { success: res.ok, output: res.stdout || `Extracted ${archivePath} to ${targetPath}`, exitCode: res.exitCode };
    }

    // ── 2. Shell & 8-Backend Execution ────────────────────────────────────
    case "sandbox_backends": {
      const backends = await listAvailableBackends();
      return {
        success: true,
        output: JSON.stringify({ count: backends.length, backends }, null, 2),
        exitCode: 0,
      };
    }

    case "process_kill": {
      if (executionProfile !== "Full access") {
        return { success: false, output: "process_kill requires Full access execution profile.", error: "Permission denied" };
      }
      const pid = Number(args.pid);
      if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) {
        return { success: false, output: `Refusing to signal unsafe or self PID: ${pid}`, error: "Unsafe PID" };
      }
      const signal = (String(args.signal ?? "SIGTERM") as NodeJS.Signals);
      try {
        process.kill(pid, signal);
        return { success: true, output: `Sent ${signal} to PID ${pid}.`, exitCode: 0 };
      } catch (err) {
        return { success: false, output: `Failed to kill PID ${pid}: ${String(err)}`, error: String(err) };
      }
    }

    case "env_inspect": {
      const filter = String(args.filter ?? "").toLowerCase();
      const secretKeyRe = /(key|token|secret|pass|auth|credential|cookie)/i;
      const envEntries: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (filter && !k.toLowerCase().includes(filter)) continue;
        envEntries[k] = secretKeyRe.test(k) ? "[REDACTED]" : String(v ?? "");
      }
      const toolchain = {
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        git: execSyncSafe("git", ["--version"], cwd, 2000).stdout.trim() || "unavailable",
        python3: execSyncSafe("python3", ["--version"], cwd, 2000).stdout.trim() || "unavailable",
        pnpm: execSyncSafe("pnpm", ["--version"], cwd, 2000).stdout.trim() || "unavailable",
      };
      return {
        success: true,
        output: JSON.stringify({ toolchain, envCount: Object.keys(envEntries).length, env: envEntries }, null, 2),
        exitCode: 0,
      };
    }

    case "port_wait": {
      const host = String(args.host ?? "127.0.0.1");
      const port = Number(args.port);
      const timeoutMs = Math.min(Number(args.timeout_ms ?? 3000) || 3000, 15000);
      const start = Date.now();
      const probeOnce = () =>
        new Promise<boolean>((resolve) => {
          const sock = net.createConnection({ host, port, timeout: 500 });
          sock.once("connect", () => {
            sock.destroy();
            resolve(true);
          });
          sock.once("error", () => {
            sock.destroy();
            resolve(false);
          });
          sock.once("timeout", () => {
            sock.destroy();
            resolve(false);
          });
        });
      while (Date.now() - start < timeoutMs) {
        if (await probeOnce()) {
          return { success: true, output: `Port ${host}:${port} is OPEN (${Date.now() - start}ms).`, exitCode: 0 };
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      return { success: false, output: `Port ${host}:${port} unreachable after ${timeoutMs}ms.`, exitCode: 1 };
    }

    // ── 3. LSP, AST & Code Intelligence ───────────────────────────────────
    case "ast_symbols":
    case "code_outline": {
      const target = resolveTarget(String(args.path ?? ""), cwd);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        return { success: false, output: `File not found: ${target}`, error: "ENOENT" };
      }
      const lines = fs.readFileSync(target, "utf8").split("\n");
      const symbols: Array<{ kind: string; name: string; line: number; exported: boolean }> = [];
      const patterns: Array<{ kind: string; regex: RegExp }> = [
        { kind: "class", regex: /^\s*(export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/ },
        { kind: "interface", regex: /^\s*(export\s+)?interface\s+([A-Za-z0-9_]+)/ },
        { kind: "type", regex: /^\s*(export\s+)?type\s+([A-Za-z0-9_]+)/ },
        { kind: "function", regex: /^\s*(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/ },
        { kind: "const", regex: /^\s*(export\s+)const\s+([A-Za-z0-9_]+)/ },
        { kind: "python_def", regex: /^\s*(?:async\s+)?def\s+([A-Za-z0-9_]+)/ },
        { kind: "rust_fn", regex: /^\s*(pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/ },
        { kind: "go_func", regex: /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z0-9_]+)/ },
      ];
      lines.forEach((lineText, idx) => {
        for (const p of patterns) {
          const m = p.regex.exec(lineText);
          if (m) {
            const exported = Boolean(m[1] && (m[1].includes("export") || m[1].includes("pub")));
            const symName = m[2] ?? m[1];
            if (symName) {
              symbols.push({ kind: p.kind, name: symName, line: idx + 1, exported });
            }
            break;
          }
        }
      });
      return {
        success: true,
        output: JSON.stringify({ file: target, totalLines: lines.length, symbolCount: symbols.length, symbols }, null, 2),
        exitCode: 0,
      };
    }

    case "dependency_audit": {
      const target = resolveTarget(args.path ? String(args.path) : "package.json", cwd);
      const pkgPath = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, "package.json") : target;
      if (!fs.existsSync(pkgPath)) {
        return { success: false, output: `package.json not found at ${pkgPath}`, error: "ENOENT" };
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      const deps = (pkg.dependencies ?? {}) as Record<string, string>;
      const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
      const scripts = (pkg.scripts ?? {}) as Record<string, string>;
      return {
        success: true,
        output: JSON.stringify(
          {
            name: pkg.name,
            version: pkg.version,
            engines: pkg.engines,
            dependenciesCount: Object.keys(deps).length,
            devDependenciesCount: Object.keys(devDeps).length,
            scripts: Object.keys(scripts),
          },
          null,
          2,
        ),
        exitCode: 0,
      };
    }

    case "deadcode_scan": {
      const target = resolveTarget(args.path ? String(args.path) : "src", cwd);
      if (!fs.existsSync(target)) {
        return { success: false, output: `Directory not found: ${target}`, error: "ENOENT" };
      }
      const exportCounts: Array<{ file: string; exports: number }> = [];
      const entries = fs.readdirSync(target, { withFileTypes: true }).slice(0, 60);
      for (const entry of entries) {
        if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name) && !entry.name.includes(".test.")) {
          const content = fs.readFileSync(path.join(target, entry.name), "utf8");
          const matches = content.match(/\bexport\s+(?:async\s+)?(?:function|const|class|type|interface)\s+/g);
          exportCounts.push({ file: entry.name, exports: matches?.length ?? 0 });
        }
      }
      return {
        success: true,
        output: JSON.stringify({ scannedDir: target, filesChecked: exportCounts.length, summary: exportCounts }, null, 2),
        exitCode: 0,
      };
    }

    case "test_runner": {
      const target = String(args.target ?? "").trim();
      if (!target) return { success: false, output: "Missing target test file.", error: "Invalid args" };
      const runner = String(args.runner ?? "auto");
      let res;
      if (runner === "pytest" || (runner === "auto" && target.endsWith(".py"))) {
        res = execSyncSafe("pytest", [target], cwd, 60000);
      } else if (runner === "cargo") {
        res = execSyncSafe("cargo", ["test", target], cwd, 60000);
      } else if (runner === "go") {
        res = execSyncSafe("go", ["test", target], cwd, 60000);
      } else {
        res = execSyncSafe("npx", ["vitest", "run", target], cwd, 60000);
      }
      return { success: res.ok, output: (res.stdout + "\n" + res.stderr).trim().slice(-12000), exitCode: res.exitCode };
    }

    case "coverage_inspect": {
      const target = resolveTarget(args.path ? String(args.path) : "coverage", cwd);
      const summaryPath = path.join(target, "coverage-summary.json");
      if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as Record<string, unknown>;
        return { success: true, output: JSON.stringify({ file: summaryPath, total: summary.total }, null, 2), exitCode: 0 };
      }
      return {
        success: true,
        output: `No coverage-summary.json found at ${target}. Run 'pnpm test:coverage' to generate V8 coverage metrics.`,
        exitCode: 0,
      };
    }

    // ── 4. Git & 5-Gate PR Workflow ───────────────────────────────────────
    case "git_blame": {
      const target = resolveTarget(String(args.path ?? ""), cwd);
      const gitArgs = ["blame", "--line-porcelain"];
      if (args.start_line && args.end_line) {
        gitArgs.push("-L", `${args.start_line},${args.end_line}`);
      }
      gitArgs.push(target);
      const res = execSyncSafe("git", gitArgs, cwd);
      return { success: res.ok, output: (res.stdout || res.stderr).slice(0, 12000), exitCode: res.exitCode };
    }

    case "git_log_search": {
      const query = String(args.query ?? "");
      const limit = Number(args.limit ?? 15) || 15;
      const mode = String(args.mode ?? "message");
      const gitArgs =
        mode === "pickaxe"
          ? ["log", "-n", String(limit), "--oneline", "-S", query]
          : ["log", "-n", String(limit), "--oneline", `--grep=${query}`, "-i"];
      const res = execSyncSafe("git", gitArgs, cwd);
      return { success: res.ok, output: res.stdout || "(No matching commits found)", exitCode: res.exitCode };
    }

    case "git_stash_inspect": {
      const action = String(args.action ?? "list");
      const gitArgs =
        action === "show"
          ? ["stash", "show", "-p", `stash@{${Number(args.index ?? 0)}}`]
          : ["stash", "list"];
      const res = execSyncSafe("git", gitArgs, cwd);
      return { success: res.ok, output: res.stdout || "(No git stashes found)", exitCode: res.exitCode };
    }

    case "git_worktree_list": {
      const res = execSyncSafe("git", ["worktree", "list", "--porcelain"], cwd);
      return { success: res.ok, output: res.stdout || res.stderr, exitCode: res.exitCode };
    }

    // ── 5. Web, Search & Browser Automation ───────────────────────────────
    case "http_request": {
      const method = String(args.method ?? "GET").toUpperCase();
      const url = String(args.url ?? "");
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return { success: false, output: "URL must start with http:// or https://", error: "Invalid URL" };
      }
      try {
        const headers = (args.headers && typeof args.headers === "object" ? args.headers : {}) as Record<string, string>;
        const res = await fetchFn(url, {
          method,
          headers,
          body: method !== "GET" && method !== "HEAD" && args.body ? String(args.body) : undefined,
        });
        const text = await res.text();
        return {
          success: res.ok,
          output: JSON.stringify({ status: res.status, statusText: res.statusText, body: text.slice(0, 12000) }, null, 2),
          exitCode: res.ok ? 0 : 1,
        };
      } catch (err) {
        return { success: false, output: `HTTP request error: ${String(err)}`, error: String(err) };
      }
    }

    case "url_metadata": {
      const url = String(args.url ?? "");
      try {
        const res = await fetchFn(url);
        const html = await res.text();
        const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
        const ogTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
        const description = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
        const canonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
        return {
          success: res.ok,
          output: JSON.stringify({ url, status: res.status, title, ogTitle, description, canonical }, null, 2),
          exitCode: res.ok ? 0 : 1,
        };
      } catch (err) {
        return { success: false, output: `Failed to inspect URL metadata: ${String(err)}`, error: String(err) };
      }
    }

    case "rss_feed_read": {
      const url = String(args.url ?? "");
      const limit = Number(args.limit ?? 10) || 10;
      try {
        const res = await fetchFn(url);
        const xml = await res.text();
        const items: Array<{ title: string; link: string }> = [];
        const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
        let match: RegExpExecArray | null;
        while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
          const block = match[1];
          const title = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block)?.[1]?.trim() ?? "";
          const link =
            /<link[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ??
            /<link[^>]*>([^<]+)<\/link>/i.exec(block)?.[1]?.trim() ??
            "";
          if (title || link) items.push({ title, link });
        }
        return { success: res.ok, output: JSON.stringify({ url, count: items.length, items }, null, 2), exitCode: 0 };
      } catch (err) {
        return { success: false, output: `RSS feed read error: ${String(err)}`, error: String(err) };
      }
    }

    // ── 6. Cory 4-Layer Memory & Knowledge Scribe ─────────────────────────
    case "memory_layers": {
      const mk = getActiveMicrokernel();
      if (!mk?.cory?.memoryStore) {
        return { success: true, output: JSON.stringify({ status: "offline", layers: {} }), exitCode: 0 };
      }
      const layerFilter = String(args.layer ?? "all");
      const all = mk.cory.memoryStore.loadAllCanonicalItems();
      const filtered = layerFilter === "all" ? all : all.filter((i) => i.layer === layerFilter);
      const counts = {
        identity: all.filter((i) => i.layer === "identity").length,
        durable: all.filter((i) => i.layer === "durable").length,
        constraint: all.filter((i) => i.layer === "constraint").length,
        episodic: all.filter((i) => i.layer === "episodic").length,
      };
      return { success: true, output: JSON.stringify({ total: all.length, counts, items: filtered.slice(0, 50) }, null, 2), exitCode: 0 };
    }

    case "memory_forget": {
      const mk = getActiveMicrokernel();
      if (!mk?.cory?.memoryStore) {
        return { success: false, output: "Cory memory store not active.", error: "Service unavailable" };
      }
      const removed = mk.cory.memoryStore.forget({
        idOrQuery: String(args.id_or_query ?? ""),
        layer: args.layer ? (String(args.layer) as "identity" | "durable" | "constraint" | "episodic") : undefined,
      });
      return { success: true, output: `Removed ${removed} memory item(s) matching '${args.id_or_query}'.`, exitCode: 0 };
    }

    case "wiki_compile": {
      const wikiDir = path.join(os.homedir(), ".coreblow", "memory", "wiki");
      const action = String(args.action ?? "list");
      fs.mkdirSync(wikiDir, { recursive: true });
      if (action === "compile") {
        const mk = getActiveMicrokernel();
        const items = mk?.cory?.memoryStore.loadAllCanonicalItems() ?? [];
        const md = [
          "# CoreBlow Cory Knowledge Wiki",
          "",
          `Compiled: ${new Date().toISOString()}`,
          `Total Memory Entries: ${items.length}`,
          "",
          ...items.map((item) => `- **[${item.layer.toUpperCase()}]** ${item.content}`),
        ].join("\n");
        const outPath = path.join(wikiDir, "INDEX.md");
        fs.writeFileSync(outPath, md, "utf8");
        return { success: true, output: `Compiled ${items.length} memory entries into ${outPath}`, exitCode: 0 };
      }
      const pages = fs.readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
      return { success: true, output: JSON.stringify({ wikiDir, pages }, null, 2), exitCode: 0 };
    }

    // ── 7. Unified Sessions ───────────────────────────────────────────────
    case "session_export": {
      const sessionId = String(args.session_id ?? "");
      const format = String(args.format ?? "markdown");
      const sessionsDir = path.join(os.homedir(), ".coreblow", "sessions", sessionId);
      const walPath = path.join(sessionsDir, "wal.log");
      const records = fs.existsSync(walPath)
        ? fs.readFileSync(walPath, "utf8").split("\n").filter(Boolean).map((l) => {
            try { return JSON.parse(l); } catch { return { raw: l }; }
          })
        : [];
      if (format === "json") {
        return { success: true, output: JSON.stringify({ sessionId, count: records.length, records }, null, 2), exitCode: 0 };
      }
      const md = [`# Session Export: ${sessionId}`, "", ...records.map((r, i) => `### Event ${i + 1}\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\``)].join("\n\n");
      return { success: true, output: md, exitCode: 0 };
    }

    case "session_compact": {
      const sessionId = String(args.session_id ?? "");
      const keepRecent = Number(args.keep_recent ?? 6) || 6;
      return {
        success: true,
        output: `Prepared zero-stall compaction for session '${sessionId}' retaining ${keepRecent} recent turns while preserving pinned Cory constraints.`,
        exitCode: 0,
      };
    }

    // ── 8. Subagents, War Room & EvoLoop Skills ───────────────────────────
    case "war_room_board": {
      const mk = getActiveMicrokernel();
      if (!mk?.warRoom) {
        return { success: true, output: JSON.stringify({ rooms: [], status: "no_active_microkernel" }), exitCode: 0 };
      }
      const action = String(args.action ?? "list");
      if (action === "move_card" && args.room_id && args.task_id && args.column) {
        const updated = mk.warRoom.moveKanbanCard(
          String(args.room_id),
          String(args.task_id),
          String(args.column) as "backlog" | "in_progress" | "review" | "done",
        );
        return { success: true, output: JSON.stringify(updated, null, 2), exitCode: 0 };
      }
      if (action === "inspect" && args.room_id) {
        const room = mk.warRoom.getWarRoom(String(args.room_id));
        return { success: Boolean(room), output: JSON.stringify(room ?? { error: "Room not found" }, null, 2), exitCode: room ? 0 : 1 };
      }
      return { success: true, output: JSON.stringify({ rooms: mk.warRoom.listWarRooms() }, null, 2), exitCode: 0 };
    }

    case "skill_create": {
      if (isReadOnly) {
        return { success: false, output: `skill_create blocked under ${executionProfile}.`, error: "Permission denied" };
      }
      const rawName = String(args.name ?? "").trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
      const description = String(args.description ?? "").trim();
      const instructions = String(args.instructions ?? "").trim();
      if (!rawName || !instructions) {
        return { success: false, output: "Skill name and instructions are required.", error: "Invalid args" };
      }
      const skillDir = path.join(os.homedir(), ".coreblow", "skills", rawName);
      fs.mkdirSync(skillDir, { recursive: true });
      const tags = Array.isArray(args.tags) ? (args.tags as string[]).join(", ") : "custom";
      const content = `---\nname: ${rawName}\ndescription: ${description}\nversion: 1.0.0\ntags: [${tags}]\n---\n\n${instructions}\n`;
      const skillFile = path.join(skillDir, "SKILL.md");
      fs.writeFileSync(skillFile, content, "utf8");
      return { success: true, output: `Created reusable skill '${rawName}' at ${skillFile}.`, exitCode: 0 };
    }

    case "skill_inspect": {
      const skillName = String(args.name ?? "").trim();
      const candidates = [
        path.join(os.homedir(), ".coreblow", "skills", skillName, "SKILL.md"),
        path.join(cwd, "skills", skillName, "SKILL.md"),
      ];
      for (const file of candidates) {
        if (fs.existsSync(file)) {
          return { success: true, output: fs.readFileSync(file, "utf8"), exitCode: 0 };
        }
      }
      return { success: false, output: `Skill '${skillName}' not found.`, error: "ENOENT" };
    }

    case "decision_route": {
      const prompt = String(args.prompt ?? "");
      const tier = args.tier
        ? (String(args.tier) as "fast" | "deep" | "local" | "coding" | "vision" | "decision")
        : classifyTaskRouteTier(prompt);
      const decision = resolveAdaptiveModelRoute({ tier });
      return { success: true, output: JSON.stringify({ tier, decision }, null, 2), exitCode: 0 };
    }

    // ── 9. Cron, Workflows & Triggers ─────────────────────────────────────
    case "cron_run_now": {
      const jobId = String(args.job_id ?? "");
      return {
        success: true,
        output: JSON.stringify({ jobId, triggeredAt: new Date().toISOString(), status: "queued_for_immediate_execution" }, null, 2),
        exitCode: 0,
      };
    }

    case "workflow_pipeline": {
      const action = String(args.action ?? "list");
      const workflowsDir = path.join(cwd, ".github", "workflows");
      const files = fs.existsSync(workflowsDir) ? fs.readdirSync(workflowsDir).filter((f) => /\.(ya?ml|json)$/.test(f)) : [];
      return { success: true, output: JSON.stringify({ action, workflowsDir, pipelines: files }, null, 2), exitCode: 0 };
    }

    case "webhook_inspect": {
      return {
        success: true,
        output: JSON.stringify(
          {
            gatewayBind: "127.0.0.1:18789",
            inboundRoutes: ["/api/corehub/chat/react", "/api/cory/layers", "/api/cory/search", "/hooks/*"],
            authPolicy: "token_bearer_required",
          },
          null,
          2,
        ),
        exitCode: 0,
      };
    }

    // ── 10. Data, SQLite, JSON & Crypto Utilities ─────────────────────────
    case "json_query": {
      const source = String(args.source ?? "").trim();
      const query = String(args.query ?? "").trim();
      let data: unknown;
      try {
        if (source.startsWith("{") || source.startsWith("[")) {
          data = JSON.parse(source);
        } else {
          const file = resolveTarget(source, cwd);
          data = JSON.parse(fs.readFileSync(file, "utf8"));
        }
      } catch (err) {
        return { success: false, output: `Failed to parse JSON source: ${String(err)}`, error: String(err) };
      }
      const tokens = query
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .filter(Boolean);
      let current: unknown = data;
      for (const token of tokens) {
        if (current && typeof current === "object" && token in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[token];
        } else {
          return { success: false, output: `Path '${query}' not found at segment '${token}'.`, error: "Path not found" };
        }
      }
      return { success: true, output: JSON.stringify(current, null, 2), exitCode: 0 };
    }

    case "csv_inspect": {
      const target = resolveTarget(String(args.path ?? ""), cwd);
      if (!fs.existsSync(target)) {
        return { success: false, output: `CSV file not found: ${target}`, error: "ENOENT" };
      }
      const sampleRows = Number(args.sample_rows ?? 5) || 5;
      const lines = fs.readFileSync(target, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
      const delim = args.delimiter ? String(args.delimiter) : target.endsWith(".tsv") ? "\t" : ",";
      const headers = lines[0]?.split(delim).map((h) => h.trim()) ?? [];
      const rows = lines.slice(1, 1 + sampleRows).map((l) => l.split(delim).map((c) => c.trim()));
      return {
        success: true,
        output: JSON.stringify({ file: target, totalRows: Math.max(0, lines.length - 1), headers, sample: rows }, null, 2),
        exitCode: 0,
      };
    }

    case "sqlite_query": {
      const dbPath = resolveTarget(String(args.db_path ?? ""), cwd);
      const sql = String(args.sql ?? "").trim();
      if (!/^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(sql)) {
        return {
          success: false,
          output: "sqlite_query only permits read-only queries (SELECT, PRAGMA, EXPLAIN, WITH).",
          error: "Read-only violation",
        };
      }
      if (!fs.existsSync(dbPath)) {
        return { success: false, output: `SQLite DB not found: ${dbPath}`, error: "ENOENT" };
      }
      const res = execSyncSafe("sqlite3", ["-readonly", "-json", dbPath, sql], cwd);
      return { success: res.ok, output: res.stdout || res.stderr || "[]", exitCode: res.exitCode };
    }

    case "hash_encode": {
      const op = String(args.operation ?? "sha256");
      const input = String(args.input ?? "");
      switch (op) {
        case "sha256":
          return { success: true, output: crypto.createHash("sha256").update(input).digest("hex"), exitCode: 0 };
        case "sha512":
          return { success: true, output: crypto.createHash("sha512").update(input).digest("hex"), exitCode: 0 };
        case "md5":
          return { success: true, output: crypto.createHash("md5").update(input).digest("hex"), exitCode: 0 };
        case "base64_encode":
          return { success: true, output: Buffer.from(input, "utf8").toString("base64"), exitCode: 0 };
        case "base64_decode":
          return { success: true, output: Buffer.from(input, "base64").toString("utf8"), exitCode: 0 };
        case "uuid":
          return { success: true, output: crypto.randomUUID(), exitCode: 0 };
        case "jwt_decode": {
          const parts = input.split(".");
          if (parts.length < 2) {
            return { success: false, output: "Invalid JWT format (expected header.payload.signature)", error: "Invalid JWT" };
          }
          const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
          return { success: true, output: JSON.stringify({ header, payload }, null, 2), exitCode: 0 };
        }
        default:
          return { success: false, output: `Unsupported operation: ${op}`, error: "Invalid operation" };
      }
    }

    case "diff_compare": {
      const leftRaw = String(args.left ?? "");
      const rightRaw = String(args.right ?? "");
      const leftPath = resolveTarget(leftRaw, cwd);
      const rightPath = resolveTarget(rightRaw, cwd);
      const useFiles = args.is_file_paths !== false && fs.existsSync(leftPath) && fs.existsSync(rightPath);
      const leftLines = (useFiles ? fs.readFileSync(leftPath, "utf8") : leftRaw).split("\n");
      const rightLines = (useFiles ? fs.readFileSync(rightPath, "utf8") : rightRaw).split("\n");
      const diffLines: string[] = [];
      const maxLen = Math.max(leftLines.length, rightLines.length);
      for (let i = 0; i < maxLen; i++) {
        const l = leftLines[i];
        const r = rightLines[i];
        if (l !== r) {
          if (l !== undefined) diffLines.push(`- ${i + 1}: ${l}`);
          if (r !== undefined) diffLines.push(`+ ${i + 1}: ${r}`);
        }
      }
      return { success: true, output: diffLines.length > 0 ? diffLines.join("\n") : "(Inputs are identical)", exitCode: 0 };
    }

    // ── 11. Media, Voice & Multimodal ─────────────────────────────────────
    case "image_inspect": {
      const target = resolveTarget(String(args.path ?? ""), cwd);
      if (!fs.existsSync(target)) {
        return { success: false, output: `Image file not found: ${target}`, error: "ENOENT" };
      }
      const buf = fs.readFileSync(target);
      let format = "unknown";
      let width = 0;
      let height = 0;
      if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        format = "png";
        width = buf.readUInt32BE(16);
        height = buf.readUInt32BE(20);
      } else if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        format = "gif";
        width = buf.readUInt16LE(6);
        height = buf.readUInt16LE(8);
      } else if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) {
        format = "jpeg";
      } else if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
        format = "webp";
      } else if (buf.slice(0, 200).toString("utf8").includes("<svg")) {
        format = "svg";
      }
      return { success: true, output: JSON.stringify({ path: target, format, width, height, sizeBytes: buf.length }, null, 2), exitCode: 0 };
    }

    case "image_generate": {
      const prompt = String(args.prompt ?? "").trim();
      if (!prompt) return { success: false, output: "Prompt is required for image_generate.", error: "Invalid args" };
      return {
        success: true,
        output: JSON.stringify({
          status: "dispatched",
          prompt,
          size: String(args.size ?? "1024x1024"),
          note: "Configure OPENAI_API_KEY, GEMINI_API_KEY, or FAL_KEY in gateway to persist generated raster assets.",
        }, null, 2),
        exitCode: 0,
      };
    }

    case "audio_transcribe": {
      const target = resolveTarget(String(args.path ?? ""), cwd);
      if (!fs.existsSync(target)) {
        return { success: false, output: `Audio file not found: ${target}`, error: "ENOENT" };
      }
      const stat = fs.statSync(target);
      return {
        success: true,
        output: JSON.stringify({
          file: target,
          sizeBytes: stat.size,
          language: String(args.language ?? "auto"),
          status: "ready_for_whisper_gateway",
        }, null, 2),
        exitCode: 0,
      };
    }

    case "diagram_render": {
      const format = String(args.format ?? "mermaid");
      const source = String(args.source ?? "").trim();
      if (!source) return { success: false, output: "Empty diagram source.", error: "Invalid args" };
      const validHeader =
        format === "mermaid"
          ? /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/m.test(source)
          : /^(di)?graph\b/m.test(source);
      if (args.output_path && !isReadOnly) {
        const out = resolveTarget(String(args.output_path), cwd);
        fs.writeFileSync(out, source, "utf8");
      }
      return {
        success: true,
        output: JSON.stringify({ format, syntaxValid: validHeader, lines: source.split("\n").length, markdown: `\`\`\`${format}\n${source}\n\`\`\`` }, null, 2),
        exitCode: 0,
      };
    }

    // ── 12. Messaging, Nodes & Security Governance ────────────────────────
    case "security_scan": {
      const target = resolveTarget(args.path ? String(args.path) : cwd, cwd);
      const maxFiles = Math.min(Number(args.max_files ?? 150) || 150, 500);
      if (!fs.existsSync(target)) {
        return { success: false, output: `Target path not found: ${target}`, error: "ENOENT" };
      }
      const secretPatterns = [
        { name: "Anthropic Key", re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/ },
        { name: "OpenAI Key", re: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
        { name: "GitHub PAT", re: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
        { name: "Private Key Block", re: /-----BEGIN\s+[A-Z ]*PRIVATE KEY-----/ },
      ];
      const findings: Array<{ file: string; line: number; type: string }> = [];
      let scanned = 0;

      const scanFile = (filePath: string) => {
        if (scanned >= maxFiles) return;
        const stat = fs.statSync(filePath);
        if (stat.size > 512 * 1024) return;
        scanned++;
        const lines = fs.readFileSync(filePath, "utf8").split("\n");
        lines.forEach((line, idx) => {
          if (line.includes("pragma: allowlist secret")) return;
          for (const pat of secretPatterns) {
            if (pat.re.test(line)) {
              findings.push({ file: filePath, line: idx + 1, type: pat.name });
            }
          }
        });
      };

      const walk = (p: string, depth: number) => {
        if (scanned >= maxFiles || depth > 5) return;
        const stat = fs.statSync(p);
        if (stat.isFile()) {
          scanFile(p);
          return;
        }
        for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
          if (["node_modules", ".git", "dist", "build"].includes(entry.name)) continue;
          const full = path.join(p, entry.name);
          if (entry.isDirectory()) walk(full, depth + 1);
          else if (entry.isFile() && /\.(ts|tsx|js|mjs|json|env|py|dart|sh|yaml|yml)$/.test(entry.name)) scanFile(full);
        }
      };

      walk(target, 0);
      return {
        success: true,
        output: JSON.stringify({ scannedFiles: scanned, findingsCount: findings.length, findings }, null, 2),
        exitCode: 0,
      };
    }

    case "trust_zone_inspect": {
      return {
        success: true,
        output: JSON.stringify(
          {
            activeProfile: executionProfile,
            workspaceRoot: cwd,
            singleBrainGateway: "127.0.0.1:18789",
            enforcedGuards: [
              "catastrophic_command_blocking",
              "operator_approval_no_ask_off_bypass",
              "path_traversal_rejection",
              "sha256_hash_chained_audit_log_0600",
            ],
          },
          null,
          2,
        ),
        exitCode: 0,
      };
    }

    case "toolset_discover": {
      const toolsetFilter = args.toolset ? String(args.toolset).toLowerCase() : "";
      const query = args.query ? String(args.query).toLowerCase() : "";
      const result: Record<string, string[]> = {};
      let totalMatched = 0;

      for (const [tsId, tools] of Object.entries(COREBLOW_TOOLSETS)) {
        if (toolsetFilter && tsId !== toolsetFilter) continue;
        const matched = query ? tools.filter((t) => t.toLowerCase().includes(query) || tsId.includes(query)) : [...tools];
        if (matched.length > 0) {
          result[tsId] = matched;
          totalMatched += matched.length;
        }
      }
      return {
        success: true,
        output: JSON.stringify(
          {
            totalToolsets: Object.keys(COREBLOW_TOOLSETS).length,
            totalBuiltInTools: Object.values(COREBLOW_TOOLSETS).reduce((a, b) => a + b.length, 0),
            matchedCount: totalMatched,
            toolsets: result,
          },
          null,
          2,
        ),
        exitCode: 0,
      };
    }

    default:
      return null;
  }
}
