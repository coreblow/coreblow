import { describe, expect, it } from "vitest";
import { redactSecrets } from "./secret-redactor.js";

describe("secret-redactor", () => {
  it("masks Anthropic API keys", () => {
    const raw = "Using Anthropic key sk-ant-api03-abcdef1234567890abcdef1234567890 for inference.";
    const result = redactSecrets(raw);
    expect(result.redacted).not.toContain("sk-ant-api03");
    expect(result.redacted).toContain("[REDACTED_ANTHROPIC_KEY]");
    expect(result.types).toContain("anthropic_api_key");
    expect(result.findingsCount).toBe(1);
  });

  it("masks OpenAI and Groq API keys", () => {
    const raw = "OpenAI key: sk-proj-1234567890abcdefghijklmnop and Groq: gsk_abcdef1234567890abcdef";
    const result = redactSecrets(raw);
    expect(result.redacted).toContain("[REDACTED_OPENAI_KEY]");
    expect(result.redacted).toContain("[REDACTED_GROQ_KEY]");
    expect(result.types).toContain("openai_api_key");
    expect(result.types).toContain("groq_api_key");
    expect(result.findingsCount).toBe(2);
  });

  it("masks Google API keys and GitHub tokens", () => {
    const raw = "Google AIzaSyD1234567890abcdef1234567890abcde and GitHub ghp_1234567890abcdefghijklmnopqrstuvwx";
    const result = redactSecrets(raw);
    expect(result.redacted).toContain("[REDACTED_GOOGLE_KEY]");
    expect(result.redacted).toContain("[REDACTED_GITHUB_TOKEN]");
    expect(result.types).toContain("google_api_key");
    expect(result.types).toContain("github_token");
  });

  it("masks AWS Access Key IDs and Slack tokens", () => {
    const raw = "AWS: AKIAIOSFODNN7EXAMPLE and Slack: xoxb-12345678901-12345678901-abcdefghijklmnopqrstuvwx";
    const result = redactSecrets(raw);
    expect(result.redacted).toContain("[REDACTED_AWS_KEY]");
    expect(result.redacted).toContain("[REDACTED_SLACK_TOKEN]");
    expect(result.types).toContain("aws_access_key");
    expect(result.types).toContain("slack_token");
  });

  it("masks Telegram bot tokens and Bearer headers", () => {
    const raw = "Telegram token 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345678 and Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
    const result = redactSecrets(raw);
    expect(result.redacted).toContain("[REDACTED_TELEGRAM_BOT_TOKEN]");
    expect(result.redacted).toContain("[REDACTED_BEARER_TOKEN]");
    expect(result.types).toContain("telegram_bot_token");
    expect(result.types).toContain("bearer_token");
  });

  it("masks embedded database passwords in connection URLs", () => {
    const raw = "Connect to postgres://app_user:super_secret_p4ssword@db.internal:5432/coreblow and mongodb+srv://admin:m0ng0_s3cr3t@cluster0.net/prod";
    const result = redactSecrets(raw);
    expect(result.redacted).not.toContain("super_secret_p4ssword");
    expect(result.redacted).not.toContain("m0ng0_s3cr3t");
    expect(result.redacted).toContain("postgres://app_user:[REDACTED_DB_PASSWORD]@db.internal:5432/coreblow");
    expect(result.redacted).toContain("mongodb+srv://admin:[REDACTED_DB_PASSWORD]@cluster0.net/prod");
    expect(result.types).toContain("database_password");
  });

  it("masks PEM private key blocks completely", () => {
    const raw = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;
    const result = redactSecrets(raw);
    expect(result.redacted).toBe("[REDACTED_PRIVATE_KEY_BLOCK]");
    expect(result.types).toContain("private_key");
    expect(result.findingsCount).toBe(1);
  });

  it("leaves clean strings untouched", () => {
    const raw = "CoreBlow ReAct Engine executed git status successfully on branch main.";
    const result = redactSecrets(raw);
    expect(result.redacted).toBe(raw);
    expect(result.findingsCount).toBe(0);
    expect(result.types).toHaveLength(0);
  });
});
