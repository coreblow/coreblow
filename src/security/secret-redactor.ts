/**
 * CoreBlow Security: Secret Redactor
 *
 * Deterministically masks sensitive credentials, tokens, API keys, database
 * passwords, and private key blocks in tool outputs, logs, and streamed chunks.
 */

export interface RedactionResult {
  redacted: string;
  findingsCount: number;
  types: string[];
}

interface SecretPattern {
  type: string;
  regex: RegExp;
  replace: (match: string, ...groups: any[]) => string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // 1. Private key blocks (PEM format)
  {
    type: "private_key",
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
    replace: () => "[REDACTED_PRIVATE_KEY_BLOCK]",
  },
  // 2. Anthropic API keys (sk-ant-...)
  {
    type: "anthropic_api_key",
    regex: /\bsk-ant-(?:api\d{2}-)?[A-Za-z0-9_\-]{20,}\b/g,
    replace: () => "[REDACTED_ANTHROPIC_KEY]",
  },
  // 3. OpenAI API keys (sk-..., sk-proj-...)
  {
    type: "openai_api_key",
    regex: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_\-]{20,}\b/g,
    replace: () => "[REDACTED_OPENAI_KEY]",
  },
  // 4. Google API keys (AIza...)
  {
    type: "google_api_key",
    regex: /\bAIza[0-9A-Za-z\-_]{30,40}\b/g,
    replace: () => "[REDACTED_GOOGLE_KEY]",
  },
  // 5. Groq API keys (gsk_...)
  {
    type: "groq_api_key",
    regex: /\bgsk_[A-Za-z0-9_\-]{20,}\b/g,
    replace: () => "[REDACTED_GROQ_KEY]",
  },
  // 6. GitHub personal & fine-grained tokens (ghp_..., github_pat_...)
  {
    type: "github_token",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,40}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
    replace: () => "[REDACTED_GITHUB_TOKEN]",
  },
  // 7. AWS Access Key IDs (AKIA...)
  {
    type: "aws_access_key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replace: () => "[REDACTED_AWS_KEY]",
  },
  // 8. Slack bot / user tokens (xoxb-..., xapp-...)
  {
    type: "slack_token",
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,}\b|\bxapp-[0-9]-[A-Za-z0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{32}\b/g,
    replace: () => "[REDACTED_SLACK_TOKEN]",
  },
  // 9. Telegram bot tokens (123456789:ABCdef...)
  {
    type: "telegram_bot_token",
    regex: /\b\d{8,10}:[A-Za-z0-9_\-]{35}\b/g,
    replace: () => "[REDACTED_TELEGRAM_BOT_TOKEN]",
  },
  // 10. HTTP Authorization: Bearer <token>
  {
    type: "bearer_token",
    regex: /((?:Authorization\s*:\s*|["']Authorization["']\s*:\s*["'])Bearer\s+)[A-Za-z0-9_\-\.]{16,}(["']?)/gi,
    replace: (_match, prefix, suffix) => `${prefix}[REDACTED_BEARER_TOKEN]${suffix}`,
  },
  // 11. Database URLs with embedded user credentials (postgres, mysql, mongodb, redis)
  {
    type: "database_password",
    regex: /((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s\/]+:)([^@\s\/]+)(@)/gi,
    replace: (_match, prefix, _pass, suffix) => `${prefix}[REDACTED_DB_PASSWORD]${suffix}`,
  },
];

const DYNAMIC_SECRETS = new Set<string>();

/**
 * Registers runtime secret values (e.g. from Credential Vault blind injection)
 * so subsequent tool/log outputs cannot echo them back.
 */
export function registerDynamicRedactionSecrets(secrets: ReadonlyArray<string>): void {
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 4) {
      DYNAMIC_SECRETS.add(secret);
    }
  }
}

export function getDynamicRedactionSecrets(): ReadonlyArray<string> {
  return Array.from(DYNAMIC_SECRETS).toSorted((a, b) => b.length - a.length);
}

export function clearDynamicRedactionSecretsForTest(): void {
  DYNAMIC_SECRETS.clear();
}

/**
 * Deterministically redacts API keys, secret credentials, passwords, and private
 * keys from a string.
 */
export function redactSecrets(text: string): RedactionResult {
  if (!text || typeof text !== "string") {
    return { redacted: text ?? "", findingsCount: 0, types: [] };
  }

  let redacted = text;
  let findingsCount = 0;
  const typesSet = new Set<string>();

  for (const dynamicSecret of getDynamicRedactionSecrets()) {
    if (redacted.includes(dynamicSecret)) {
      findingsCount += redacted.split(dynamicSecret).length - 1;
      typesSet.add("vault_secret");
      redacted = redacted.replaceAll(dynamicSecret, "[REDACTED_VAULT_SECRET]");
    }
  }

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    const matches = redacted.match(pattern.regex);
    if (matches && matches.length > 0) {
      findingsCount += matches.length;
      typesSet.add(pattern.type);
      redacted = redacted.replace(pattern.regex, pattern.replace);
    }
  }

  return {
    redacted,
    findingsCount,
    types: Array.from(typesSet),
  };
}
