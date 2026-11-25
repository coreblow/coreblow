import { Command } from "commander";
import { defaultRuntime } from "../runtime.js";

function fail(message: string): never {
  defaultRuntime.error(message);
  defaultRuntime.exit(1);
  throw new Error(message);
}

function printJson(value: unknown): void {
  defaultRuntime.writeJson(value);
}

async function resolveSecretOption(params: {
  direct?: string;
  file?: string;
  directFlag: string;
  fileFlag: string;
  label: string;
}) {
  const direct = params.direct?.trim();
  const file = params.file?.trim();
  if (direct && file) {
    throw new Error(`Use either ${params.directFlag} or ${params.fileFlag} for ${params.label}.`);
  }
  if (file) {
    const { readSecretFromFile } = await import("../acp/secret-file.js");
    return readSecretFromFile(file, params.label);
  }
  return direct || undefined;
}

function warnSecretCliFlag(flag: "--token" | "--password") {
  defaultRuntime.error(
    `Warning: ${flag} can be exposed via process listings. Prefer ${flag}-file or environment variables.`,
  );
}

export function registerMcpCli(program: Command) {
  const mcp = program.command("mcp").description("Manage CoreBlow MCP config and channel bridge");

  mcp
    .command("serve")
    .description(
      "Expose CoreBlow's 75 native tools (or Gateway channel bridge with --url/--channel-bridge) over MCP stdio",
    )
    .option(
      "--url <url>",
      "Connect Gateway channel bridge to WebSocket URL instead of standalone native tools",
    )
    .option("--channel-bridge", "Run the Gateway channel notification bridge over MCP stdio", false)
    .option("--token <token>", "Gateway token (if required)")
    .option("--token-file <path>", "Read gateway token from file")
    .option("--password <password>", "Gateway password (if required)")
    .option("--password-file <path>", "Read gateway password from file")
    .option(
      "--channel-mode <mode>",
      "CoreBlow channel notification mode: auto, on, or off",
      "auto",
    )
    .option("-v, --verbose", "Verbose logging to stderr", false)
    .action(async (opts) => {
      try {
        const useChannelBridge = Boolean(opts.url) || Boolean(opts.channelBridge);
        if (!useChannelBridge) {
          const { serveSovereignNativeMcp } = await import("../mcp/coreblow-tools-serve.js");
          await serveSovereignNativeMcp();
          return;
        }
        const gatewayToken = await resolveSecretOption({
          direct: opts.token as string | undefined,
          file: opts.tokenFile as string | undefined,
          directFlag: "--token",
          fileFlag: "--token-file",
          label: "Gateway token",
        });
        const gatewayPassword = await resolveSecretOption({
          direct: opts.password as string | undefined,
          file: opts.passwordFile as string | undefined,
          directFlag: "--password",
          fileFlag: "--password-file",
          label: "Gateway password",
        });
        if (opts.token) {
          warnSecretCliFlag("--token");
        }
        if (opts.password) {
          warnSecretCliFlag("--password");
        }
        const rawChannelMode = opts.channelMode ?? "auto";
        const channelMode = String(rawChannelMode).trim().toLowerCase();
        if (channelMode !== "auto" && channelMode !== "on" && channelMode !== "off") {
          throw new Error("Invalid --channel-mode value. Use auto, on, or off.");
        }
        const resolvedUrl =
          (opts.url as string | undefined) ||
          process.env.COREBLOW_GATEWAY_URL?.trim() ||
          "ws://127.0.0.1:18789";
        const { serveCoreBlowChannelMcp } = await import("../mcp/channel-server.js");
        await serveCoreBlowChannelMcp({
          gatewayUrl: resolvedUrl,
          gatewayToken,
          gatewayPassword,
          channelMode: channelMode as "auto" | "on" | "off",
          verbose: Boolean(opts.verbose),
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  mcp
    .command("list")
    .description("List configured MCP servers")
    .option("--json", "Print JSON")
    .action(async (opts: { json?: boolean }) => {
      const { listConfiguredMcpServers } = await import("../config/mcp-config.js");
      const loaded = await listConfiguredMcpServers();
      if (!loaded.ok) {
        fail(loaded.error);
      }
      if (opts.json) {
        printJson(loaded.mcpServers);
        return;
      }
      const names = Object.keys(loaded.mcpServers).toSorted();
      if (names.length === 0) {
        defaultRuntime.log(`No MCP servers configured in ${loaded.path}.`);
        return;
      }
      defaultRuntime.log(`MCP servers (${loaded.path}):`);
      for (const name of names) {
        defaultRuntime.log(`- ${name}`);
      }
    });

  mcp
    .command("show")
    .description("Show one configured MCP server or the full MCP config")
    .argument("[name]", "MCP server name")
    .option("--json", "Print JSON")
    .action(async (name: string | undefined, opts: { json?: boolean }) => {
      const { listConfiguredMcpServers } = await import("../config/mcp-config.js");
      const loaded = await listConfiguredMcpServers();
      if (!loaded.ok) {
        fail(loaded.error);
      }
      const value = name ? loaded.mcpServers[name] : loaded.mcpServers;
      if (name && !value) {
        fail(`No MCP server named "${name}" in ${loaded.path}.`);
      }
      if (opts.json) {
        printJson(value ?? {});
        return;
      }
      if (name) {
        defaultRuntime.log(`MCP server "${name}" (${loaded.path}):`);
      } else {
        defaultRuntime.log(`MCP servers (${loaded.path}):`);
      }
      printJson(value ?? {});
    });

  mcp
    .command("set")
    .description("Set one configured MCP server from a JSON object")
    .argument("<name>", "MCP server name")
    .argument("<value>", 'JSON object, for example {"command":"uvx","args":["context7-mcp"]}')
    .action(async (name: string, rawValue: string) => {
      const [{ parseConfigValue }, { setConfiguredMcpServer }] = await Promise.all([
        import("../auto-reply/reply/config-value.js"),
        import("../config/mcp-config.js"),
      ]);
      const parsed = parseConfigValue(rawValue);
      if (parsed.error) {
        fail(parsed.error);
      }
      const result = await setConfiguredMcpServer({ name, server: parsed.value });
      if (!result.ok) {
        fail(result.error);
      }
      defaultRuntime.log(`Saved MCP server "${name}" to ${result.path}.`);
    });

  mcp
    .command("unset")
    .description("Remove one configured MCP server")
    .argument("<name>", "MCP server name")
    .action(async (name: string) => {
      const { unsetConfiguredMcpServer } = await import("../config/mcp-config.js");
      const result = await unsetConfiguredMcpServer({ name });
      if (!result.ok) {
        fail(result.error);
      }
      if (!result.removed) {
        fail(`No MCP server named "${name}" in ${result.path}.`);
      }
      defaultRuntime.log(`Removed MCP server "${name}" from ${result.path}.`);
    });
}
