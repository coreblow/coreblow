import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoDiscoverRuntimeEndpoints,
  cleanToolBlocksFromText,
  COREBLOW_OPENAI_TOOLS,
  CoreBlowToolExecutor,
  detectAndNormalizePath,
  detectBashCommandsToIntercept,
  generateWorkspaceSnapshot,
  isCommandAllowed,
  isPathInWorkspace,
  normalizePath,
  parseXmlToolCalls,
  runCoreBlowReActLoop,
} from "./coreblow-react-engine.js";

describe("CoreBlow Autonomous ReAct Engine", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-react-test-"));
  });

  afterEach(() => {
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
    });
  });
});
