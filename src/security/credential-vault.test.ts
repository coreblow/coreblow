import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { redactSensitiveText } from "../logging/redact.js";
import {
  addVaultEntry,
  buildBrowserVaultFillExpression,
  generateTotpCode,
  generateVaultTotp,
  listVaultEntries,
  removeVaultEntry,
  resolveVaultFilePath,
  resolveVaultSecretForOrigin,
} from "./credential-vault.js";
import { clearDynamicRedactionSecretsForTest, redactSecrets } from "./secret-redactor.js";

describe("Credential Vault (browser-only blind autofill & 2FA)", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    clearDynamicRedactionSecretsForTest();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeEnv(): NodeJS.ProcessEnv {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-vault-test-"));
    tempDirs.push(dir);
    return { ...process.env, COREBLOW_STATE_DIR: dir };
  }

  it("encrypts entries with 0o600 permissions and never exposes raw secrets in list metadata", () => {
    const env = makeEnv();
    const meta = addVaultEntry({
      id: "acme-login",
      kind: "login",
      label: "Acme Portal",
      identifier: "ops@example.com",
      allowedOrigins: ["https://portal.example.com/login"],
      payload: {
        password: "SuperSecretVaultPassword!99",
        totpSecret: "JBSWY3DPEHPK3PXP",
      },
      env,
    });

    expect(meta.allowedOrigins).toEqual(["https://portal.example.com"]);
    expect(meta.hasTotp).toBe(true);

    const vaultPath = resolveVaultFilePath(env);
    const mode = fs.statSync(vaultPath).mode & 0o777;
    expect(mode).toBe(0o600);

    const rawEncrypted = fs.readFileSync(vaultPath, "utf8");
    expect(rawEncrypted).not.toContain("SuperSecretVaultPassword!99");
    expect(rawEncrypted).not.toContain("JBSWY3DPEHPK3PXP");

    const listed = JSON.stringify(listVaultEntries(env));
    expect(listed).not.toContain("SuperSecretVaultPassword!99");
    expect(listed).not.toContain("JBSWY3DPEHPK3PXP");
    expect(listed).toContain("ops@example.com");

    expect(removeVaultEntry("acme-login", env)).toBe(true);
    expect(listVaultEntries(env)).toHaveLength(0);
  });

  it("fails closed on origin mismatch and rejects wildcard origins", () => {
    const env = makeEnv();
    expect(() =>
      addVaultEntry({
        kind: "login",
        label: "Wildcard",
        allowedOrigins: ["https://*.example.com"],
        payload: { password: "pw" },
        env,
      }),
    ).toThrow("no wildcards");

    addVaultEntry({
      id: "bank",
      kind: "login",
      label: "Bank",
      allowedOrigins: ["https://app.bank.example"],
      payload: { password: "VaultBankPassword#42", totpSecret: "JBSWY3DPEHPK3PXP" },
      env,
    });

    expect(() =>
      resolveVaultSecretForOrigin({
        entryId: "bank",
        currentOrigin: "https://evil.bank.example",
        env,
      }),
    ).toThrow("origin mismatch");

    expect(() =>
      generateVaultTotp({
        entryId: "bank",
        currentOrigin: "https://evil.bank.example",
        env,
      }),
    ).toThrow("origin mismatch");

    const resolved = resolveVaultSecretForOrigin({
      entryId: "bank",
      currentOrigin: "https://app.bank.example/signin",
      env,
    });
    expect(resolved.payload.password).toBe("VaultBankPassword#42");

    // Dynamic redaction boundary catches resolved vault secrets in subsequent outputs
    const leaked = "DOM snapshot value=VaultBankPassword#42";
    expect(redactSecrets(leaked).redacted).not.toContain("VaultBankPassword#42");
    expect(redactSensitiveText(leaked)).not.toContain("VaultBankPassword#42");
  });

  it("generates deterministic RFC 6238 TOTP codes and builds origin-checked masked DOM scripts", () => {
    // RFC 6238 test vector for ASCII "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ) at t=59s -> 94287082 (8 digits)
    const code = generateTotpCode(
      "otpauth://totp/Test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8&period=30",
      59_000,
    );
    expect(code).toBe("94287082");

    const script = buildBrowserVaultFillExpression({
      expectedOrigin: "https://auth.example.com",
      fields: [{ selector: 'input[type="password"]', value: "Secret!123" }],
    });
    expect(script).toContain('window.location.origin !== "https://auth.example.com"');
    expect(script).toContain("Vault DOM injection failed.");
  });
});
