import { describe, expect, it } from "vitest";
import {
  createAnthropicVertexStreamFn,
  createAnthropicVertexStreamFnForModel,
} from "./stream-runtime.js";

describe("anthropic-vertex stream runtime facade", () => {
  it("re-exports the CoreBlow Anthropic Vertex stream factories", () => {
    expect(createAnthropicVertexStreamFn).toBeTypeOf("function");
    expect(createAnthropicVertexStreamFnForModel).toBeTypeOf("function");
  });
});
