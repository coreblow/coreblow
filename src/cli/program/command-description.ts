import { t } from "../../infra/i18n/index.js";

export function commandDescription(name: string, fallback: string): string {
  const keyName = name === "secrets" ? "credential_controls" : name;
  const key = `cli_help.commands.${keyName}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}
