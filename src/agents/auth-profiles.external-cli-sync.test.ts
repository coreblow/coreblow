import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthProfileStore, OAuthCredential } from "./auth-profiles/types.js";

const mocks = vi.hoisted(() => ({
  readCodexCliCredentialsCached: vi.fn<() => OAuthCredential | null>(() => null),
  readMiniMaxCliCredentialsCached: vi.fn<() => OAuthCredential | null>(() => null),
}));

let syncExternalCliCredentials: typeof import("./auth-profiles/external-cli-sync.js").syncExternalCliCredentials;
let shouldReplaceStoredOAuthCredential: typeof import("./auth-profiles/external-cli-sync.js").shouldReplaceStoredOAuthCredential;
let CODEX_CLI_PROFILE_ID: typeof import("./auth-profiles/constants.js").CODEX_CLI_PROFILE_ID;
let OPENAI_CODEX_DEFAULT_PROFILE_ID: typeof import("./auth-profiles/constants.js").OPENAI_CODEX_DEFAULT_PROFILE_ID;
let MINIMAX_CLI_PROFILE_ID: typeof import("./auth-profiles/constants.js").MINIMAX_CLI_PROFILE_ID;

function makeOAuthCredential(
  overrides: Partial<OAuthCredential> & Pick<OAuthCredential, "provider">,
): OAuthCredential {
  return {
    type: "oauth" as const,
    provider: overrides.provider,
    access: overrides.access ?? `${overrides.provider}-access`,
    refresh: overrides.refresh ?? `${overrides.provider}-refresh`,
    expires: overrides.expires ?? Date.now() + 60_000,
    accountId: overrides.accountId,
    email: overrides.email,
  } as OAuthCredential;
}

function makeStore(profileId?: string, credential?: OAuthCredential): AuthProfileStore {
  return {
    version: 1,
    profiles: profileId && credential ? { [profileId]: credential } : {},
  };
}

describe("syncExternalCliCredentials", () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.readCodexCliCredentialsCached.mockReset().mockReturnValue(null);
    mocks.readMiniMaxCliCredentialsCached.mockReset().mockReturnValue(null);
    vi.doMock("./cli-credentials.js", () => ({
      readCodexCliCredentialsCached: mocks.readCodexCliCredentialsCached,
      readMiniMaxCliCredentialsCached: mocks.readMiniMaxCliCredentialsCached,
    }));
    ({ syncExternalCliCredentials, shouldReplaceStoredOAuthCredential } =
      await import("./auth-profiles/external-cli-sync.js"));
    ({ CODEX_CLI_PROFILE_ID, OPENAI_CODEX_DEFAULT_PROFILE_ID, MINIMAX_CLI_PROFILE_ID } =
      await import("./auth-profiles/constants.js"));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("shouldReplaceStoredOAuthCredential", () => {
    it("keeps equivalent stored credentials", () => {
      const stored = makeOAuthCredential({ provider: "openai-codex", access: "a", refresh: "r" });
      const incoming = makeOAuthCredential({
        provider: "openai-codex",
        access: "a",
        refresh: "r",
      });

      expect(shouldReplaceStoredOAuthCredential(stored, incoming)).toBe(false);
    });

    it("replaces stored credential when incoming is newer (higher expires)", () => {
      const stored = makeOAuthCredential({
        provider: "openai-codex",
        access: "old",
        refresh: "r",
        expires: Date.now() + 1_000,
      });
      const incoming = makeOAuthCredential({
        provider: "openai-codex",
        access: "new",
        refresh: "r",
        expires: Date.now() + 3_600_000,
      });

      expect(shouldReplaceStoredOAuthCredential(stored, incoming)).toBe(true);
    });

    it("does not replace if incoming has different refresh token and stored is still valid", () => {
      const stored = makeOAuthCredential({
        provider: "openai-codex",
        access: "a",
        refresh: "r-stored",
        expires: Date.now() + 3_600_000,
      });
      const incoming = makeOAuthCredential({
        provider: "openai-codex",
        access: "a",
        refresh: "r-new",
        expires: Date.now() + 1_000,
      });

      expect(shouldReplaceStoredOAuthCredential(stored, incoming)).toBe(false);
    });
  });

  describe.each([
    { label: "Codex", getProfileId: (): string => OPENAI_CODEX_DEFAULT_PROFILE_ID, provider: "openai-codex" as const, getMock: () => mocks.readCodexCliCredentialsCached },
    { label: "MiniMax", getProfileId: (): string => MINIMAX_CLI_PROFILE_ID, provider: "minimax-portal" as const, getMock: () => mocks.readMiniMaxCliCredentialsCached },
  ])("$label external CLI sync", ({ getProfileId, provider, getMock }) => {
    it("does nothing when external CLI returns null", () => {
      const store = makeStore();
      getMock().mockReturnValue(null);

      const changed = syncExternalCliCredentials(store);
      expect(changed).toBe(false);
      expect(Object.keys(store.profiles)).toHaveLength(0);
    });

    it("injects credential from external CLI when store is empty", () => {
      const store = makeStore();
      const credential = makeOAuthCredential({ provider });
      getMock().mockReturnValue(credential);

      const changed = syncExternalCliCredentials(store);
      expect(changed).toBe(true);

      const profileId = getProfileId();
      expect(store.profiles[profileId]).toMatchObject({
        type: "oauth",
        provider,
      });
    });
  });
});
