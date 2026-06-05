import type { CoreBlowConfig } from "../config/types.coreblow.js";

export const TALK_TEST_PROVIDER_ID = "acme-speech";
export const TALK_TEST_PROVIDER_LABEL = "Acme Speech";
const TALK_TEST_PROVIDER_CREDENTIAL_FIELD = ["api", "Key"].join("");

export const TALK_TEST_PROVIDER_CREDENTIAL_PATH =
  `talk.providers.${TALK_TEST_PROVIDER_ID}.${TALK_TEST_PROVIDER_CREDENTIAL_FIELD}`;
export const TALK_TEST_PROVIDER_CREDENTIAL_PATH_SEGMENTS = [
  "talk",
  "providers",
  TALK_TEST_PROVIDER_ID,
  TALK_TEST_PROVIDER_CREDENTIAL_FIELD,
] as const;

export function buildTalkTestProviderConfig(credential: unknown): CoreBlowConfig {
  return {
    talk: {
      providers: {
        [TALK_TEST_PROVIDER_ID]: {
          [TALK_TEST_PROVIDER_CREDENTIAL_FIELD]: credential,
        },
      },
    },
  } as CoreBlowConfig;
}

export function readTalkTestProviderCredential(config: CoreBlowConfig): unknown {
  const provider = config.talk?.providers?.[TALK_TEST_PROVIDER_ID] as
    | Record<string, unknown>
    | undefined;
  return provider?.[TALK_TEST_PROVIDER_CREDENTIAL_FIELD];
}
