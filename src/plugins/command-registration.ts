import { isOperatorScope } from "../gateway/operator-scopes.js";
import { logVerbose } from "../globals.js";
import {
  clearPluginCommands,
  clearPluginCommandsForPlugin,
  getPluginCommandSpecs,
  isPluginCommandRegistryLocked,
  pluginCommands,
  type RegisteredPluginCommand,
} from "./command-registry-state.js";
import type { CoreBlowPluginCommandDefinition } from "./types.js";

/**
 * Reserved command names that plugins cannot override (built-in commands).
 *
 * Constructed lazily inside validateCommandName to avoid TDZ errors: the
 * bundler can place this module's body after call sites within the same
 * output chunk, so any module-level const/let would be uninitialized when
 * first accessed during plugin registration.
 */
// eslint-disable-next-line no-var -- var avoids TDZ when bundler reorders module bodies in a chunk
var reservedCommands: Set<string> | undefined;

function getReservedCommands(): Set<string> {
  reservedCommands ??= new Set([
    "help",
    "commands",
    "status",
    "diagnostics",
    "codex",
    "whoami",
    "context",
    "btw",
    "stop",
    "restart",
    "reset",
    "new",
    "compact",
    "config",
    "debug",
    "allowlist",
    "activation",
    "skill",
    "subagents",
    "kill",
    "steer",
    "tell",
    "model",
    "models",
    "queue",
    "send",
    "bash",
    "exec",
    "think",
    "verbose",
    "reasoning",
    "elevated",
    "usage",
  ]);
  return reservedCommands;
}

export type CommandRegistrationResult = {
  ok: boolean;
  error?: string;
};

export function isReservedCommandName(name: string): boolean {
  const trimmed = name.trim().toLowerCase();
  return Boolean(trimmed && getReservedCommands().has(trimmed));
}

export function validateCommandName(
  name: string,
  opts?: { allowReservedCommandNames?: boolean },
): string | null {
  const trimmed = name.trim().toLowerCase();

  if (!trimmed) {
    return "Command name cannot be empty";
  }

  // Must start with a letter, contain only letters, numbers, hyphens, underscores
  // Note: trimmed is already lowercased, so no need for /i flag
  if (!/^[a-z][a-z0-9_-]*$/.test(trimmed)) {
    return "Command name must start with a letter and contain only letters, numbers, hyphens, and underscores";
  }

  if (!opts?.allowReservedCommandNames && getReservedCommands().has(trimmed)) {
    return `Command name "${trimmed}" is reserved by a built-in command`;
  }

  return null;
}

/**
 * Validate a plugin command definition without registering it.
 * Returns an error message if invalid, or null if valid.
 * Shared by both the global registration path and snapshot (non-activating) loads.
 */
export function validatePluginCommandDefinition(
  command: CoreBlowPluginCommandDefinition,
  opts?: { allowReservedCommandNames?: boolean },
): string | null {
  if (typeof command.handler !== "function") {
    return "Command handler must be a function";
  }
  if (typeof command.name !== "string") {
    return "Command name must be a string";
  }
  if (typeof command.description !== "string") {
    return "Command description must be a string";
  }
  if (!command.description.trim()) {
    return "Command description cannot be empty";
  }
  if (command.ownership === "reserved") {
    if (!opts?.allowReservedCommandNames) {
      return "Reserved command ownership is only available to bundled reserved commands";
    }
    if (!isReservedCommandName(command.name)) {
      return `Reserved command ownership requires a reserved command name: ${command.name.trim().toLowerCase()}`;
    }
  }
  const nameError = validateCommandName(command.name.trim(), opts);
  if (nameError) {
    return nameError;
  }
  for (const [label, alias] of Object.entries(command.nativeNames ?? {})) {
    if (typeof alias !== "string") {
      continue;
    }
    const aliasError = validateCommandName(alias.trim());
    if (aliasError) {
      return `Native command alias "${label}" invalid: ${aliasError}`;
    }
  }
  if (command.requiredScopes !== undefined) {
    if (!Array.isArray(command.requiredScopes)) {
      return "Command requiredScopes must be an array of operator scopes";
    }
    const unknownScope = (command.requiredScopes as readonly unknown[]).find(
      (scope) => !isOperatorScope(scope),
    );
    if (unknownScope) {
      return typeof unknownScope === "string"
        ? `Command requiredScopes contains unknown operator scope: ${unknownScope}`
        : "Command requiredScopes contains unknown operator scope";
    }
  }
  return null;
}

export function listPluginInvocationKeys(command: CoreBlowPluginCommandDefinition): string[] {
  const keys = new Set<string>();
  const push = (value: string | undefined) => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    keys.add(`/${normalized}`);
  };

  push(command.name);
  push(command.nativeNames?.default);
  push(command.nativeNames?.telegram);
  push(command.nativeNames?.discord);

  return [...keys];
}

export function registerPluginCommand(
  pluginId: string,
  command: CoreBlowPluginCommandDefinition,
  opts?: { pluginName?: string; pluginRoot?: string; allowReservedCommandNames?: boolean },
): CommandRegistrationResult {
  // Prevent registration while commands are being processed
  if (isPluginCommandRegistryLocked()) {
    return { ok: false, error: "Cannot register commands while processing is in progress" };
  }
  if (command.ownership === "reserved") {
    return {
      ok: false,
      error: "Reserved command ownership is only available to bundled reserved commands",
    };
  }

  const definitionError = validatePluginCommandDefinition(command, opts);
  if (definitionError) {
    return { ok: false, error: definitionError };
  }

  const name = command.name.trim();
  const description = command.description.trim();
  const normalizedCommand = {
    ...command,
    name,
    description,
  };
  const invocationKeys = listPluginInvocationKeys(normalizedCommand);
  const key = `/${name.toLowerCase()}`;

  // Check for duplicate registration
  for (const invocationKey of invocationKeys) {
    const existing =
      pluginCommands.get(invocationKey) ??
      Array.from(pluginCommands.values()).find((candidate) =>
        listPluginInvocationKeys(candidate).includes(invocationKey),
      );
    if (existing) {
      return {
        ok: false,
        error: `Command "${invocationKey.slice(1)}" already registered by plugin "${existing.pluginId}"`,
      };
    }
  }

  pluginCommands.set(key, {
    ...normalizedCommand,
    pluginId,
    pluginName: opts?.pluginName,
    pluginRoot: opts?.pluginRoot,
  });
  logVerbose(`Registered plugin command: ${key} (plugin: ${pluginId})`);
  return { ok: true };
}

export function pluginCommandSupportsChannel(
  command: CoreBlowPluginCommandDefinition,
  channel?: string,
): boolean {
  if (!command.channels || command.channels.length === 0 || !channel) {
    return true;
  }
  const normalizedChannel = channel.trim().toLowerCase();
  return command.channels.some(
    (entry) => entry.trim().toLowerCase() === normalizedChannel,
  );
}

export { clearPluginCommands, clearPluginCommandsForPlugin, getPluginCommandSpecs };
export type { RegisteredPluginCommand };
