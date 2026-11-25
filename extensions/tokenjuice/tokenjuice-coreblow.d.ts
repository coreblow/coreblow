declare module "tokenjuice/openclaw" {
  export function createTokenjuiceOpenClawEmbeddedExtension(): (api: {
    on(event: "tool_result", handler: unknown): void;
  }) => void;
}
