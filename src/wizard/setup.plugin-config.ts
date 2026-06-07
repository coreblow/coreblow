import type { CoreBlowConfig } from "../config/config.js";
import type { PluginConfigUiHint } from "../plugins/types.js";
import { getPath, setPathCreateStrict } from "../secrets/path-utils.js";
import { t } from "./i18n/index.js";
import type { WizardPrompter } from "./prompts.js";

type JsonSchemaObject = {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchemaObject>;
};

export type ConfigurablePlugin = {
  id: string;
  name: string;
  uiHints: Record<string, PluginConfigUiHint>;
  jsonSchema?: JsonSchemaObject;
};

type ManifestPluginLike = {
  id: string;
  name?: string;
  configUiHints?: Record<string, PluginConfigUiHint>;
  configSchema?: Record<string, unknown>;
  enabled?: boolean;
  enabledByDefault?: boolean;
};

type JsonSchemaProperty = {
  type?: string;
  enum?: unknown[];
  description?: string;
};

function resolveJsonSchemaProperty(
  jsonSchema: JsonSchemaObject | undefined,
  fieldKey: string,
): JsonSchemaProperty | undefined {
  if (!jsonSchema) {
    return undefined;
  }
  let cursor: unknown = jsonSchema;
  for (const segment of fieldKey.split(".")) {
    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }
    const properties = (cursor as Record<string, unknown>).properties;
    if (!properties || typeof properties !== "object") {
      return undefined;
    }
    cursor = (properties as Record<string, unknown>)[segment];
  }
  return cursor && typeof cursor === "object" ? (cursor as JsonSchemaProperty) : undefined;
}

function getExistingPluginConfig(
  config: CoreBlowConfig,
  pluginId: string,
): Record<string, unknown> {
  return (config.plugins?.entries?.[pluginId]?.config as Record<string, unknown>) ?? {};
}

function toPathSegments(fieldKey: string): string[] {
  return fieldKey.split(".").filter(Boolean);
}

function formatCurrentValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return JSON.stringify(value);
}

export function discoverConfigurablePlugins(params: {
  manifestPlugins: ReadonlyArray<ManifestPluginLike>;
}): ConfigurablePlugin[] {
  const result: ConfigurablePlugin[] = [];
  for (const plugin of params.manifestPlugins) {
    if (!plugin.configUiHints) {
      continue;
    }
    const promptableHints: Record<string, PluginConfigUiHint> = {};
    for (const [key, hint] of Object.entries(plugin.configUiHints)) {
      if (!hint.advanced) {
        promptableHints[key] = hint;
      }
    }
    if (Object.keys(promptableHints).length === 0) {
      continue;
    }
    result.push({
      id: plugin.id,
      name: plugin.name ?? plugin.id,
      uiHints: promptableHints,
      jsonSchema: plugin.configSchema as JsonSchemaObject | undefined,
    });
  }
  return result.toSorted((a, b) => a.name.localeCompare(b.name));
}

export function discoverUnconfiguredPlugins(params: {
  manifestPlugins: ReadonlyArray<ManifestPluginLike>;
  config: CoreBlowConfig;
}): ConfigurablePlugin[] {
  const all = discoverConfigurablePlugins(params);
  return all.filter((plugin) => {
    const existing = getExistingPluginConfig(params.config, plugin.id);
    return Object.keys(plugin.uiHints).some((key) => {
      const val = getPath(existing, toPathSegments(key));
      return val === undefined || val === null || val === "";
    });
  });
}

async function promptPluginFields(params: {
  plugin: ConfigurablePlugin;
  config: CoreBlowConfig;
  prompter: WizardPrompter;
  showConfigured?: boolean;
}): Promise<CoreBlowConfig> {
  const existing = getExistingPluginConfig(params.config, params.plugin.id);
  const updatedConfig = structuredClone(existing);
  let changed = false;

  for (const [key, hint] of Object.entries(params.plugin.uiHints)) {
    const pathSegments = toPathSegments(key);
    const currentValue = getPath(existing, pathSegments);
    const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== "";
    if (hasValue && !params.showConfigured) {
      continue;
    }

    const schemaProp = resolveJsonSchemaProperty(params.plugin.jsonSchema, key);
    const label = hint.label ?? key;
    const helpSuffix = hint.help ? ` - ${hint.help}` : "";

    if (hint.sensitive) {
      await params.prompter.note(
        t("wizard.plugins.sensitiveField", {
          label,
          plugin: params.plugin.id,
          field: key,
        }),
        t("wizard.plugins.sensitiveTitle"),
      );
      continue;
    }

    if (schemaProp?.enum && Array.isArray(schemaProp.enum)) {
      const options = schemaProp.enum.map((value) => ({
        value: String(value),
        label: String(value),
      }));
      if (hasValue) {
        options.unshift({
          value: "__keep__",
          label: t("wizard.plugins.currentValue", { value: formatCurrentValue(currentValue) }),
        });
      }
      const selected = await params.prompter.select({
        message: `${label}${helpSuffix}`,
        options,
        initialValue: hasValue ? "__keep__" : undefined,
      });
      if (selected !== "__keep__") {
        setPathCreateStrict(updatedConfig, pathSegments, selected);
        changed = true;
      }
      continue;
    }

    if (schemaProp?.type === "boolean") {
      const confirmed = await params.prompter.confirm({
        message: `${label}${helpSuffix}`,
        initialValue: typeof currentValue === "boolean" ? currentValue : false,
      });
      if (confirmed !== currentValue) {
        setPathCreateStrict(updatedConfig, pathSegments, confirmed);
        changed = true;
      }
      continue;
    }

    const input = await params.prompter.text({
      message: `${label}${helpSuffix}`,
      initialValue: formatCurrentValue(currentValue),
      placeholder: hint.placeholder,
    });
    if (input !== formatCurrentValue(currentValue)) {
      setPathCreateStrict(updatedConfig, pathSegments, input);
      changed = true;
    }
  }

  if (!changed) {
    return params.config;
  }
  return {
    ...params.config,
    plugins: {
      ...params.config.plugins,
      entries: {
        ...params.config.plugins?.entries,
        [params.plugin.id]: {
          ...params.config.plugins?.entries?.[params.plugin.id],
          config: updatedConfig,
        },
      },
    },
  };
}

export async function setupPluginConfig(params: {
  config: CoreBlowConfig;
  prompter: WizardPrompter;
  manifestPlugins?: ReadonlyArray<ManifestPluginLike>;
  showConfigured?: boolean;
}): Promise<CoreBlowConfig> {
  const plugins = params.showConfigured
    ? discoverConfigurablePlugins({ manifestPlugins: params.manifestPlugins ?? [] })
    : discoverUnconfiguredPlugins({
        manifestPlugins: params.manifestPlugins ?? [],
        config: params.config,
      });
  if (plugins.length === 0) {
    return params.config;
  }
  const selected = await params.prompter.select({
    message: t("wizard.plugins.configureSelect"),
    options: plugins.map((plugin) => ({
      value: plugin.id,
      label: plugin.name,
      hint: t("wizard.plugins.fieldsCount", {
        count: Object.keys(plugin.uiHints).length,
        plural: Object.keys(plugin.uiHints).length === 1 ? "" : "s",
      }),
    })),
  });
  const plugin = plugins.find((candidate) => candidate.id === selected);
  return plugin
    ? promptPluginFields({
        plugin,
        config: params.config,
        prompter: params.prompter,
        showConfigured: params.showConfigured,
      })
    : params.config;
}

export const configurePluginConfig = setupPluginConfig;
