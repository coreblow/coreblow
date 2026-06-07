import { describe, expect, it, vi } from "vitest";
import { hasAwsCredentials, testing } from "./embedding-provider.js";

describe("hasAwsCredentials", () => {
  it("accepts static AWS key credentials without loading the credential chain", async () => {
    const loadCredentialProvider = vi.fn();

    await expect(
      hasAwsCredentials(
        {
          AWS_ACCESS_KEY_ID: "access-key",
          AWS_SECRET_ACCESS_KEY: "secret-key",
        },
        loadCredentialProvider,
      ),
    ).resolves.toBe(true);

    expect(loadCredentialProvider).not.toHaveBeenCalled();
  });

  it("accepts the Bedrock bearer token without loading the credential chain", async () => {
    const loadCredentialProvider = vi.fn();

    await expect(
      hasAwsCredentials(
        {
          AWS_BEARER_TOKEN_BEDROCK: "bearer-token",
        },
        loadCredentialProvider,
      ),
    ).resolves.toBe(true);

    expect(loadCredentialProvider).not.toHaveBeenCalled();
  });

  it("returns false when the AWS credential provider package is unavailable", async () => {
    const loadCredentialProvider = vi.fn().mockResolvedValue(null);

    await expect(hasAwsCredentials({}, loadCredentialProvider)).resolves.toBe(false);
  });
});

describe("bedrock embedding response parsers", () => {
  it("wraps malformed single embedding JSON", () => {
    expect(() => testing.parseSingle("titan-v2", "{not json")).toThrow(
      "Amazon Bedrock embedding response returned malformed JSON",
    );
  });

  it("rejects wrong single embedding vector element types", () => {
    expect(() => testing.parseSingle("titan-v2", '{"embedding":[1,"bad"]}')).toThrow(
      "Amazon Bedrock embedding response returned malformed JSON",
    );
  });

  it("wraps malformed batch embedding JSON", () => {
    expect(() => testing.parseCohereBatch("cohere-v3", "{not json")).toThrow(
      "Amazon Bedrock embedding response returned malformed JSON",
    );
  });
});
