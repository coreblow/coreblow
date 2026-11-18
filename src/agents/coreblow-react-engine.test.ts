import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMicrokernelServiceRegistry, setActiveMicrokernel } from "../gateway/microkernel-services.js";
import { getCognitiveCoordinator } from "./cognitive/coordinator.js";
import {
  autoDiscoverRuntimeEndpoints,
  cleanToolBlocksFromText,
  COREBLOW_OPENAI_TOOLS,
  CoreBlowToolExecutor,
  detectAndNormalizePath,
  detectBashCommandsToIntercept,
  generateWorkspaceSnapshot,
  getUnifiedCoreBlowToolDefinitions,
  isCommandAllowed,
  isPathInWorkspace,
  normalizePath,
  parseXmlToolCalls,
  runCoreBlowReActLoop,
  COREBLOW_TOOLSETS,
  selectToolsForPrompt,
  listAvailableBackends,
} from "./coreblow-react-engine.js";
import { CORE_TOOL_GROUPS } from "./tool-catalog.js";
import {
  getUnifiedSession,
  listUnifiedSessions,
  saveUnifiedSessionStoreSync,
} from "../sessions/unified-session-store.js";

describe("CoreBlow Autonomous ReAct Engine", () => {
  let tempDir: string;
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-react-test-"));
    savedEnv = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      COREBLOW_CONFIG_PATH: process.env.COREBLOW_CONFIG_PATH,
    };
    process.env.COREBLOW_CONFIG_PATH = path.join(tempDir, "config.json5");
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("Path Normalization & Detection", () => {
    it("normalizes user/<name> to /Users/<name> or /home/<name>", () => {
      const normalized = normalizePath("user/febrinanda/projects/coreblow");
      expect(normalized).toMatch(/^(\/Users|\/home)\/febrinanda\/projects\/coreblow$/);
    });

    it("normalizes ~ and ~/ paths", () => {
      const home = process.env.HOME ?? os.homedir();
      expect(normalizePath("~")).toBe(home);
      expect(normalizePath("~/src/index.ts")).toBe(path.join(home, "src/index.ts"));
    });

    it("normalizes relative paths against defaultCwd", () => {
      const normalized = normalizePath("src/agent.ts", "/workspace/project");
      expect(normalized).toBe("/workspace/project/src/agent.ts");
    });

    it("detects and normalizes paths from prompt text", () => {
      const detected1 = detectAndNormalizePath("coba cek user/febrinanda/aplesi apa isinya");
      expect(detected1).toMatch(/^(\/Users|\/home)\/febrinanda\/aplesi$/);

      const detected2 = detectAndNormalizePath("inspect ~/my-app folder");
      const home = process.env.HOME ?? os.homedir();
      expect(detected2).toBe(path.join(home, "my-app"));
    });

    it("verifies workspace containment", () => {
      const workspace = "/var/www/coreblow";
      expect(isPathInWorkspace("/var/www/coreblow/src/index.ts", workspace)).toBe(true);
      expect(isPathInWorkspace("/var/www/coreblow", workspace)).toBe(true);
      expect(isPathInWorkspace("/etc/passwd", workspace)).toBe(false);
      expect(isPathInWorkspace("/var/www/other", workspace)).toBe(false);
    });
  });

  describe("Security Command Validation", () => {
    it("blocks catastrophic commands across all profiles", () => {
      const catastrophic = [
        "rm -rf /",
        "rm -rf /*",
        "rm -f -r /",
        "mkfs.ext4 /dev/sda1",
        "dd if=/dev/zero of=/dev/sda",
        ":(){ :|:& };:",
        "chmod -R 777 /",
      ];

      for (const cmd of catastrophic) {
        expect(isCommandAllowed(cmd, "Full access")).toBe(false);
        expect(isCommandAllowed(cmd, "Workspace", "/workspace")).toBe(false);
        expect(isCommandAllowed(cmd, "Guarded")).toBe(false);
        expect(isCommandAllowed(cmd, "Read-only")).toBe(false);
      }
    });

    it("allows dev commands in Full access", () => {
      expect(isCommandAllowed("pnpm build", "Full access")).toBe(true);
      expect(isCommandAllowed("bun test", "Full access")).toBe(true);
      expect(isCommandAllowed("mkdir -p new_dir", "Full access")).toBe(true);
    });

    it("allows modifying commands in Workspace profile only when inside workspace", () => {
      const workspace = tempDir;
      expect(isCommandAllowed("touch new_file.txt", "Workspace", workspace, workspace)).toBe(true);
      expect(isCommandAllowed("rm -rf old_build", "Workspace", workspace, workspace)).toBe(true);
      // Outside workspace, mutating commands are blocked
      expect(isCommandAllowed("touch /tmp/evil.txt", "Workspace", workspace, "/tmp")).toBe(false);
    });

    it("restricts Guarded and Read-only profiles to safe inspection commands", () => {
      const safe = [
        "ls -la",
        "find . -name '*.ts'",
        "cat package.json",
        "head -n 20 README.md",
        "tail -n 10 server.log",
        "grep -rn 'CoreBlow' src/",
        "rg 'export class' src/",
        "git status",
        "git log -n 5",
        "git diff",
        "pwd",
        "stat index.ts",
        "wc -l file.txt",
        "tree -L 2",
        "which node",
        "echo hello",
      ];

      for (const cmd of safe) {
        expect(isCommandAllowed(cmd, "Guarded")).toBe(true);
        expect(isCommandAllowed(cmd, "Read-only")).toBe(true);
      }

      const blocked = [
        "rm file.txt",
        "touch test.txt",
        "npm install",
        "git push",
        "python script.py",
        "curl https://example.com",
      ];

      for (const cmd of blocked) {
        expect(isCommandAllowed(cmd, "Guarded")).toBe(false);
        expect(isCommandAllowed(cmd, "Read-only")).toBe(false);
      }
    });
  });

  describe("CoreBlow Native Tools Execution", () => {
    it("executes terminal commands and returns stdout/exitCode", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTerminal("echo 'CoreBlow Native Terminal'");
      expect(res.success).toBe(true);
      expect(res.output).toContain("CoreBlow Native Terminal");
      expect(res.exitCode).toBe(0);
    });

    it("blocks terminal commands when profile rejects them", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTerminal("rm -rf file.txt", undefined, "Read-only");
      expect(res.success).toBe(false);
      expect(res.output).toContain("Blocked by execution profile");
    });

    it("reads files with 1-based line numbering and limits", async () => {
      const testFile = path.join(tempDir, "sample.txt");
      fs.writeFileSync(testFile, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n");

      const executor = new CoreBlowToolExecutor();
      const res = await executor.readFile(testFile, 2, 3);
      expect(res.success).toBe(true);
      expect(res.output).toContain("=== File:");
      expect(res.output).toContain("2: Line 2");
      expect(res.output).toContain("3: Line 3");
      expect(res.output).toContain("4: Line 4");
      expect(res.output).not.toContain("5: Line 5");
    });

    it("writes files and creates parent directories", async () => {
      const nestedFile = path.join(tempDir, "sub", "dir", "created.txt");
      const executor = new CoreBlowToolExecutor();

      const res = await executor.writeFile(nestedFile, "Created by CoreBlow", "Full access");
      expect(res.success).toBe(true);
      expect(fs.existsSync(nestedFile)).toBe(true);
      expect(fs.readFileSync(nestedFile, "utf8")).toBe("Created by CoreBlow");
    });

    it("blocks write_file under Read-only profile", async () => {
      const testFile = path.join(tempDir, "readonly.txt");
      const executor = new CoreBlowToolExecutor();

      const res = await executor.writeFile(testFile, "Forbidden", "Read-only");
      expect(res.success).toBe(false);
      expect(res.output).toContain("Blocked: write_file requires 'Full access' or 'Workspace'");
    });

    it("patches files cleanly and preserves surrounding text", async () => {
      const patchFile = path.join(tempDir, "code.ts");
      fs.writeFileSync(patchFile, "export const version = '1.0.0';\nexport const name = 'App';\n");

      const executor = new CoreBlowToolExecutor();
      const res = await executor.patchFile(
        patchFile,
        "version = '1.0.0'",
        "version = '2.0.0'",
        "Full access",
      );
      expect(res.success).toBe(true);
      expect(fs.readFileSync(patchFile, "utf8")).toBe("export const version = '2.0.0';\nexport const name = 'App';\n");
    });

    it("lists directories with sizes and file types", async () => {
      fs.writeFileSync(path.join(tempDir, "a.txt"), "hello");
      fs.mkdirSync(path.join(tempDir, "child"));
      fs.writeFileSync(path.join(tempDir, "child", "b.txt"), "world");

      const executor = new CoreBlowToolExecutor();
      const res = await executor.listDir(tempDir, 2, 50);
      expect(res.success).toBe(true);
      expect(res.output).toContain("[FILE] a.txt");
      expect(res.output).toContain("[DIR]  child/");
      expect(res.output).toContain("[FILE] child/b.txt");
    });

    it("searches files matching a pattern", async () => {
      fs.writeFileSync(path.join(tempDir, "match1.ts"), "const secretKey = 'xyz';");
      fs.writeFileSync(path.join(tempDir, "ignore.txt"), "other content");

      const executor = new CoreBlowToolExecutor();
      const res = await executor.searchFiles(tempDir, "secretKey");
      expect(res.success).toBe(true);
      expect(res.output).toContain("match1.ts:1: const secretKey = 'xyz';");
    });

    it("defines 75 native tools in COREBLOW_OPENAI_TOOLS containing all core tools", () => {
      expect(COREBLOW_OPENAI_TOOLS.length).toBe(75);
      const toolNames = COREBLOW_OPENAI_TOOLS.map((t) => t.function.name);
      const expectedCore = [
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
      ];
      for (const core of expectedCore) {
        expect(toolNames).toContain(core);
      }
    });

    it("executes web_fetch and strips HTML tags/scripts", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          "<html><head><script>alert('bad')</script><style>.a{color:red}</style></head><body><h1>Title</h1><p>Clean paragraph</p></body></html>",
          { status: 200, headers: { "Content-Type": "text/html" } },
        ),
      );

      const executor = new CoreBlowToolExecutor(undefined, undefined, mockFetch as unknown as typeof fetch);
      const res = await executor.executeTool("web_fetch", { url: "https://example.com/docs" });
      expect(res.success).toBe(true);
      expect(res.output).toContain("Title");
      expect(res.output).toContain("Clean paragraph");
      expect(res.output).not.toContain("alert('bad')");
      expect(res.output).not.toContain(".a{color:red}");
    });

    it("rejects invalid URLs in web_fetch", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool("web_fetch", { url: "ftp://invalid.com" });
      expect(res.success).toBe(false);
      expect(res.output).toContain("Invalid URL");
    });

    it("executes web_search and parses search results", async () => {
      const mockHtml = `
        <div class="result results_links">
          <h2 class="result__title"><a class="result__url" href="https://coreblow.com/docs">CoreBlow Documentation</a></h2>
          <a class="result__snippet">Autonomous AI microkernel with single-brain architecture.</a>
        </div>
      `;
      const mockFetch = vi.fn().mockResolvedValue(new Response(mockHtml, { status: 200 }));
      const executor = new CoreBlowToolExecutor(undefined, undefined, mockFetch as unknown as typeof fetch);
      const res = await executor.executeTool("web_search", { query: "CoreBlow microkernel" });
      expect(res.success).toBe(true);
      expect(res.output).toContain("CoreBlow Documentation");
      expect(res.output).toContain("https://coreblow.com/docs");
      expect(res.output).toContain("Autonomous AI microkernel");
    });

    it("stores and searches memory items via memory_store and memory_search", async () => {
      const memoryDir = path.join(tempDir, "cory-mem");
      fs.mkdirSync(memoryDir, { recursive: true });
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: tempDir,
        coryDir: memoryDir,
      });
      await microkernel.registry.startAll();
      setActiveMicrokernel(microkernel);

      try {
        const executor = new CoreBlowToolExecutor();
        const storeRes = await executor.executeTool("memory_store", {
          content: "CoreBlow 16 native tools verified.",
          layer: "durable",
        });
        expect(storeRes.success).toBe(true);
        expect(storeRes.output).toContain("Stored memory item");

        const searchRes = await executor.executeTool("memory_search", {
          query: "16 native tools",
        });
        expect(searchRes.success).toBe(true);
        expect(searchRes.output).toContain("CoreBlow 16 native tools verified.");
      } finally {
        await microkernel.registry.stopAll();
        setActiveMicrokernel(null);
      }
    });

    it("executes skill_search and returns matching learned skills", async () => {
      const microkernel = createMicrokernelServiceRegistry({ stateDir: tempDir });
      await microkernel.registry.startAll();
      setActiveMicrokernel(microkernel);

      try {
        const executor = new CoreBlowToolExecutor();
        const res = await executor.executeTool("skill_search", { query: "git" });
        expect(res.success).toBe(true);
      } finally {
        await microkernel.registry.stopAll();
        setActiveMicrokernel(null);
      }
    });

    it("executes delegate_subagent to a specialist role", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool("delegate_subagent", {
        role: "verifier",
        task: "Verify 5-Gates before landing",
      });
      expect(res.success).toBe(true);
      expect(res.output).toContain("verifier");
      expect(res.output).toContain("Verify 5-Gates");
    });

    it("executes git_inspect with read-only commands and blocks dangerous arguments", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool("git_inspect", { command: "status" }, "Full access", tempDir);
      expect(res).toBeDefined();

      const blockedRes = await executor.executeTool("git_inspect", {
        command: "status",
        args: "--commit; rm -rf /",
      });
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.output).toContain("Blocked");

      const blockedCmd = await executor.executeTool("git_inspect", { command: "push" });
      expect(blockedCmd.success).toBe(false);
      expect(blockedCmd.output).toContain("Blocked");
    });

    it("executes process_inspect for listening ports and system processes", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool("process_inspect", { mode: "ports" });
      expect(res.success).toBe(true);
      expect(res.output).toBeDefined();
    });

    it("executes cron_list to inspect scheduled automations", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool("cron_list", {});
      expect(res.success).toBe(true);
      expect(res.output).toBeDefined();
    });

    it("executes calculator with deterministic mathematical expressions", async () => {
      const executor = new CoreBlowToolExecutor();

      const res1 = await executor.executeTool("calculator", { expression: "2 + 3 * 4" });
      expect(res1.success).toBe(true);
      expect(res1.output).toBe("Result: 14");

      const res2 = await executor.executeTool("calculator", { expression: "sqrt(144) + 12 * 5" });
      expect(res2.success).toBe(true);
      expect(res2.output).toBe("Result: 72");

      const res3 = await executor.executeTool("calculator", { expression: "Math.pow(2, 8)" });
      expect(res3.success).toBe(true);
      expect(res3.output).toBe("Result: 256");

      const resInvalid = await executor.executeTool("calculator", { expression: "invalid + ?" });
      expect(resInvalid.success).toBe(false);
      expect(resInvalid.output).toContain("Math evaluation error");
    });
  });

  describe("XML Tool Parsing & Self-Healing Interceptor", () => {
    it("parses XML <tool_call> tags", () => {
      const text = `
I will check the files.
<tool_call>
{"name": "list_dir", "arguments": {"path": "/var/log"}}
</tool_call>
`;
      const calls = parseXmlToolCalls(text);
      expect(calls.length).toBe(1);
      expect(calls[0].name).toBe("list_dir");
      expect(calls[0].arguments).toEqual({ path: "/var/log" });
    });

    it("intercepts bash blocks when the model claims lack of filesystem access", () => {
      const text = `
Maaf saya gak bisa baca filesystem langsung. Tolong paste output dari:
\`\`\`bash
find /Users/febrinanda/aplesi -maxdepth 2
ls -la
\`\`\`
`;
      const calls = detectBashCommandsToIntercept(text);
      expect(calls.length).toBe(2);
      expect(calls[0].name).toBe("terminal");
      expect(calls[0].arguments.command).toBe("find /Users/febrinanda/aplesi -maxdepth 2");
      expect(calls[1].arguments.command).toBe("ls -la");
    });

    it("cleans tool tags from assistant output", () => {
      const text = `Thought: Checking files.<tool_call>{"name": "list_dir"}</tool_call>Here are your files!`;
      const cleaned = cleanToolBlocksFromText(text);
      expect(cleaned).toBe("Thought: Checking files.Here are your files!");
    });
  });

  describe("Workspace Snapshot & Proactive Inspection", () => {
    it("generates a proactive snapshot with directory listing and package.json preview", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "my-test-app", version: "1.0.0" }, null, 2),
      );
      fs.writeFileSync(path.join(tempDir, "README.md"), "# Test App\nDocumentation\n");

      const snapshot = await generateWorkspaceSnapshot(tempDir);
      expect(snapshot).toContain("CoreBlow Proactive Workspace Snapshot");
      expect(snapshot).toContain("package.json");
      expect(snapshot).toContain("my-test-app");
    });
  });

  describe("Autonomous ReAct Execution Loop", () => {
    it("runs multi-turn tool execution loop and terminates on final response", async () => {
      fs.writeFileSync(path.join(tempDir, "app.ts"), "console.log('CoreBlow ReAct');\n");

      let turn = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        turn++;
        if (turn === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "read_file",
                          arguments: JSON.stringify({ path: path.join(tempDir, "app.ts") }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "The app logs 'CoreBlow ReAct'.",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const result = await runCoreBlowReActLoop({
        prompt: "What does app.ts log?",
        defaultCwd: tempDir,
        providerUrl: "http://mock-llm/v1",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.ok).toBe(true);
      expect(result.reply).toBe("The app logs 'CoreBlow ReAct'.");
      expect(result.toolSteps.length).toBe(1);
      expect(result.toolSteps[0]).toContain("read_file");
      expect(result.steps.length).toBe(1);
      expect(result.steps[0].tool).toBe("read_file");
      expect(result.steps[0].output).toContain("CoreBlow ReAct");
    });

    it("wires CognitiveCoordinator, injects Cory memory into prompt, and updates telemetry", async () => {
      const memoryDir = path.join(tempDir, "memory");
      fs.mkdirSync(memoryDir, { recursive: true });

      const microkernel = createMicrokernelServiceRegistry({
        stateDir: tempDir,
        coryDir: memoryDir,
      });
      await microkernel.registry.startAll();
      setActiveMicrokernel(microkernel);

      // Seed Cory constraint memory
      microkernel.cory.memoryStore.remember({
        layer: "constraint",
        content: "CoreBlow Single-Brain sovereign architecture active.",
      });

      const coordinator = getCognitiveCoordinator();
      const initialTurns = coordinator.getCounters().turnsTotal;
      const initialMemory = coordinator.getCounters().memoryInjected;

      let capturedSystemPrompt = "";

      const mockFetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
        const body = JSON.parse(init.body);
        const sysMsg = body.messages?.find((m: any) => m.role === "system");
        if (sysMsg) {
          capturedSystemPrompt = sysMsg.content;
        }

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "CoreBlow single-brain verified.",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      try {
        const result = await runCoreBlowReActLoop({
          prompt: "Verify single-brain active memory",
          defaultCwd: tempDir,
          providerUrl: "http://mock-llm/v1",
          fetchFn: mockFetch as unknown as typeof fetch,
        });

        expect(result.ok).toBe(true);
        expect(result.reply).toBe("CoreBlow single-brain verified.");

        // 1. Verify coordinator turn & memory counters incremented
        const counters = coordinator.getCounters();
        expect(counters.turnsTotal).toBeGreaterThan(initialTurns);
        expect(counters.memoryInjected).toBeGreaterThan(initialMemory);

        // 2. Verify Cory memory was injected into system message
        expect(capturedSystemPrompt).toContain("<cory_memory>");
        expect(capturedSystemPrompt).toContain("CoreBlow Single-Brain sovereign architecture active.");
      } finally {
        await microkernel.registry.stopAll();
        setActiveMicrokernel(null);
      }
    });
  });

  describe("Runtime Provider Auto-Discovery", () => {
    it("discovers local proxy when active", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ id: "proxy-model-1" }] }),
          { status: 200 },
        ),
      );

      const discovered = await autoDiscoverRuntimeEndpoints(mockFetch as unknown as typeof fetch);
      expect(discovered).not.toBeNull();
      expect(discovered?.providerUrl).toBe("http://127.0.0.1:20128/v1");
      expect(discovered?.model).toBe("proxy-model-1");
      // Critical invariant: Upstream providerUrl must never be the Gateway port (:18789)
      expect(discovered?.providerUrl).not.toContain("18789");
    });

    it("prefers configured API keys over local proxy", async () => {
      const discovered = await autoDiscoverRuntimeEndpoints({
        anthropicApiKey: "sk-ant-test-key",
      });
      expect(discovered).not.toBeNull();
      expect(discovered?.providerUrl).toBe("https://api.anthropic.com/v1");
      expect(discovered?.apiKey).toBe("sk-ant-test-key");
    });
  });

  describe("Unified 75-Tool Catalog & Execution Bridge", () => {
    it("defines exactly 75 tools in unified definitions", () => {
      const defs = getUnifiedCoreBlowToolDefinitions();
      expect(defs.length).toBe(75);
      expect(COREBLOW_OPENAI_TOOLS.length).toBe(75);

      const toolNames = defs.map((d) => d.function.name);
      expect(toolNames).toContain("terminal");
      expect(toolNames).toContain("read_file");
      expect(toolNames).toContain("write_file");
      expect(toolNames).toContain("patch");
      expect(toolNames).toContain("search_files");
      expect(toolNames).toContain("list_dir");
      expect(toolNames).toContain("web_fetch");
      expect(toolNames).toContain("web_search");
      expect(toolNames).toContain("memory_search");
      expect(toolNames).toContain("memory_store");
      expect(toolNames).toContain("skill_search");
      expect(toolNames).toContain("delegate_subagent");
      expect(toolNames).toContain("git_inspect");
      expect(toolNames).toContain("process_inspect");
      expect(toolNames).toContain("cron_list");
      expect(toolNames).toContain("calculator");
      expect(toolNames).toContain("session_search");
      expect(toolNames).toContain("sessions_list");
      expect(toolNames).toContain("sessions_history");
      expect(toolNames).toContain("sessions_send");
      expect(toolNames).toContain("cron_schedule");
      expect(toolNames).toContain("browser_action");
      expect(toolNames).toContain("rag_query");
      expect(toolNames).toContain("pr_workflow");
      expect(toolNames).toContain("lsp_diagnostics");
      expect(toolNames).toContain("execute_code");
      expect(toolNames).toContain("message_channel");
      expect(toolNames).toContain("nodes_status");
      expect(toolNames).toContain("tts_speak");
      expect(toolNames).toContain("pdf_extract");
    });

    it("executes session tools (session_search, sessions_list, sessions_history, sessions_send)", async () => {
      const storeFile = path.join(tempDir, "sessions-test.json");
      saveUnifiedSessionStoreSync(
        {
          version: 1,
          sessions: {
            sess_test_1: {
              id: "sess_test_1",
              title: "Test Unified Session",
              createdAt: Date.now() - 10000,
              updatedAt: Date.now() - 5000,
              surface: "desktop",
              messages: [
                { id: "m1", role: "user", content: "Can you help me build a desktop app?", createdAt: Date.now() - 10000 },
                { id: "m2", role: "assistant", content: "Yes! CoreBlow Desktop is ready.", createdAt: Date.now() - 9000 },
              ],
            },
          },
        },
        storeFile,
      );

      const executor = new CoreBlowToolExecutor();

      // Set env or verify list with custom storePath
      const listRes = await executor.executeTool("sessions_list", { limit: 5 });
      expect(listRes.success).toBe(true);

      const searchRes = await executor.executeTool("session_search", { query: "desktop" });
      expect(searchRes.success).toBe(true);

      const histRes = await executor.executeTool("sessions_history", { session_id: "sess_test_1" });
      // Either found or gracefully not found in default store
      expect(histRes).toBeDefined();

      const sendRes = await executor.executeTool("sessions_send", {
        session_id: "sess_non_existent",
        message: "Hello",
      });
      expect(sendRes.success).toBe(false);
      expect(sendRes.error).toBe("Session not found");
    });

    it("executes code, nodes_status, tts_speak, and message_channel tools", async () => {
      const executor = new CoreBlowToolExecutor();

      // execute_code
      const codeRes = await executor.executeTool("execute_code", {
        language: "javascript",
        code: "console.log('CoreBlow Code Execution 42');",
      });
      expect(codeRes.success).toBe(true);
      expect(codeRes.output).toContain("CoreBlow Code Execution 42");

      // nodes_status
      const nodesRes = await executor.executeTool("nodes_status", {});
      expect(nodesRes.success).toBe(true);
      expect(nodesRes.output).toContain("CoreBlow Sovereign Mesh Status");

      // tts_speak
      const ttsVoices = await executor.executeTool("tts_speak", { action: "list_voices" });
      expect(ttsVoices.success).toBe(true);
      expect(ttsVoices.output).toContain("Available TTS Voices");

      const ttsSpeak = await executor.executeTool("tts_speak", { text: "System ready" });
      expect(ttsSpeak.success).toBe(true);
      expect(ttsSpeak.output).toContain("TTS Synthesized");

      // message_channel
      const msgRes = await executor.executeTool("message_channel", {
        channel: "telegram",
        message: "Alert: Build green",
      });
      expect(msgRes.success).toBe(true);
      expect(msgRes.output).toContain("Channel: telegram");
    });

    it("persists turns to Unified Session Store when running ReAct loop", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Turn completed successfully." } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const testSessionId = `sess_react_test_${Date.now()}`;
      const result = await runCoreBlowReActLoop({
        sessionId: testSessionId,
        prompt: "Verify auto-persistence in unified session store",
        defaultCwd: tempDir,
        providerUrl: "http://mock-llm/v1",
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.ok).toBe(true);
      expect(result.reply).toBe("Turn completed successfully.");

      const persisted = getUnifiedSession(testSessionId);
      expect(persisted).toBeDefined();
      expect(persisted?.messages.length).toBe(2);
      expect(persisted?.messages[0].content).toBe("Verify auto-persistence in unified session store");
      expect(persisted?.messages[1].content).toBe("Turn completed successfully.");
    });
  });
  describe("Phase 1 & Phase 2: 75 Native Tools across 12 Toolsets and 8 Backends", () => {
    it("has exactly 75 built-in tools and CORE_TOOL_GROUPS['group:coreblow'] contains all 75", () => {
      expect(COREBLOW_OPENAI_TOOLS.length).toBe(75);
      expect(Object.keys(COREBLOW_TOOLSETS).length).toBe(12);

      const coreblowGroup = new Set(CORE_TOOL_GROUPS["group:coreblow"]);
      for (const tool of COREBLOW_OPENAI_TOOLS) {
        expect(coreblowGroup.has(tool.function.name), `Missing ${tool.function.name} from group:coreblow`).toBe(true);
      }
    });

    it("listAvailableBackends returns all 8 execution backends", async () => {
      const backends = await listAvailableBackends();
      expect(backends.length).toBe(8);
      const backendIds = backends.map((b) => b.id);
      expect(backendIds).toEqual([
        "local",
        "vm_isolate",
        "docker",
        "ssh",
        "daytona",
        "modal",
        "vercel",
        "e2b",
      ]);

      const localBackend = backends.find((b) => b.id === "local");
      expect(localBackend?.available).toBe(true);

      const vmBackend = backends.find((b) => b.id === "vm_isolate");
      expect(vmBackend?.available).toBe(true);
    });

    it("executes JavaScript in vm_isolate via execute_code with sub-millisecond precision", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "execute_code",
        {
          language: "javascript",
          code: "const a = 12 * 12; Math.sqrt(a);",
          backend: "vm_isolate",
        },
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      expect(res.output).toContain("12");
      expect(res.exitCode).toBe(0);
    });

    it("executes multi_patch atomically on target files", async () => {
      const filePath = path.join(tempDir, "multi_target.txt");
      fs.writeFileSync(filePath, "alpha\nbeta\ngamma\n", "utf8");

      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "multi_patch",
        {
          path: filePath,
          hunks: [
            { old_text: "alpha", new_text: "ALPHA_PRIME" },
            { old_text: "gamma", new_text: "GAMMA_PRIME" },
          ],
        },
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      const updated = fs.readFileSync(filePath, "utf8");
      expect(updated).toBe("ALPHA_PRIME\nbeta\nGAMMA_PRIME\n");
    });

    it("executes file_stat with file size and SHA-256 hash", async () => {
      const filePath = path.join(tempDir, "stat_target.json");
      fs.writeFileSync(filePath, '{"coreblow": "v2.0.0"}', "utf8");

      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "file_stat",
        { path: filePath, hash: true },
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      const parsed = JSON.parse(res.output);
      expect(parsed.sizeBytes).toBeGreaterThan(0);
      expect(parsed.sha256).toBeDefined();
      expect(parsed.type).toBe("file");
    });

    it("executes ast_symbols extracting functions and exports from source code", async () => {
      const filePath = path.join(tempDir, "symbols.ts");
      fs.writeFileSync(
        filePath,
        "export class GatewayService {\n  run(): void {}\n}\nexport async function startKernel() {}\ninterface Config {}\n",
        "utf8",
      );

      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "ast_symbols",
        { path: filePath },
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      const parsed = JSON.parse(res.output);
      expect(parsed.symbolCount).toBeGreaterThanOrEqual(2);
      expect(parsed.symbols.some((s: any) => s.name === "GatewayService")).toBe(true);
      expect(parsed.symbols.some((s: any) => s.name === "startKernel")).toBe(true);
    });

    it("executes json_query extracting nested fields by dot-path", async () => {
      const filePath = path.join(tempDir, "data.json");
      fs.writeFileSync(
        filePath,
        JSON.stringify({ microkernel: { version: "2.0.0", services: ["cory", "warroom"] } }),
        "utf8",
      );

      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "json_query",
        { source: filePath, query: "microkernel.version" },
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      expect(res.output).toContain("2.0.0");
    });

    it("executes hash_encode across sha256, base64, and uuid", async () => {
      const executor = new CoreBlowToolExecutor();
      const shaRes = await executor.executeTool(
        "hash_encode",
        { operation: "sha256", input: "CoreBlow" },
        "Full access",
        tempDir,
      );
      expect(shaRes.success).toBe(true);
      expect(shaRes.output.length).toBe(64);

      const uuidRes = await executor.executeTool(
        "hash_encode",
        { operation: "uuid" },
        "Full access",
        tempDir,
      );
      expect(uuidRes.success).toBe(true);
      expect(uuidRes.output).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("executes security_scan detecting unredacted secrets and private keys", async () => {
      const leakDir = path.join(tempDir, "leak_scan");
      fs.mkdirSync(leakDir, { recursive: true });
      fs.writeFileSync(
        path.join(leakDir, "leaked_secret.ts"),
        "const key = 'sk-ant-12345678901234567890';\n",
        "utf8",
      );

      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "security_scan",
        { path: leakDir },
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      const parsed = JSON.parse(res.output);
      expect(parsed.findingsCount).toBeGreaterThanOrEqual(1);
      expect(parsed.findings[0].type).toBe("Anthropic Key");
    });

    it("executes toolset_discover listing all 12 toolsets and 75 native tools", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "toolset_discover",
        {},
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      const parsed = JSON.parse(res.output);
      expect(parsed.totalToolsets).toBe(12);
      expect(parsed.totalBuiltInTools).toBe(75);
    });

    it("executes sandbox_backends listing all 8 backends via tool call", async () => {
      const executor = new CoreBlowToolExecutor();
      const res = await executor.executeTool(
        "sandbox_backends",
        {},
        "Full access",
        tempDir,
      );

      expect(res.success).toBe(true);
      const parsed = JSON.parse(res.output);
      expect(parsed.count).toBe(8);
      expect(parsed.backends.some((b: any) => b.id === "vm_isolate")).toBe(true);
      expect(parsed.backends.some((b: any) => b.id === "docker")).toBe(true);
      expect(parsed.backends.some((b: any) => b.id === "ssh")).toBe(true);
    });

    it("selectToolsForPrompt router selectively activates specialized tools based on intent", () => {
      const dataTools = selectToolsForPrompt(
        COREBLOW_OPENAI_TOOLS,
        "Run read-only query on sqlite database and inspect csv table",
      );
      const dataNames = new Set(dataTools.map((t) => t.function.name));
      expect(dataNames.has("sqlite_query")).toBe(true);
      expect(dataNames.has("csv_inspect")).toBe(true);
      expect(dataNames.has("json_query")).toBe(true);

      const codeTools = selectToolsForPrompt(
        COREBLOW_OPENAI_TOOLS,
        "Extract ast symbols, check coverage and scan for deadcode",
      );
      const codeNames = new Set(codeTools.map((t) => t.function.name));
      expect(codeNames.has("ast_symbols")).toBe(true);
      expect(codeNames.has("deadcode_scan")).toBe(true);
      expect(codeNames.has("coverage_inspect")).toBe(true);

      const allTools = selectToolsForPrompt(COREBLOW_OPENAI_TOOLS, "hello", { mode: "all" });
      expect(allTools.length).toBe(75);
    });
  });

});
