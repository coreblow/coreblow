import { describe, expect, it } from "vitest";
import {
  configureLmstudioNonInteractive,
  discoverLmstudioProvider,
  prepareLmstudioDynamicModels,
  promptAndConfigureLmstudioInteractive,
} from "./setup.js";

describe("lmstudio setup facade", () => {
  it("exports the CoreBlow-native setup and discovery helpers", () => {
    expect(configureLmstudioNonInteractive).toBeTypeOf("function");
    expect(discoverLmstudioProvider).toBeTypeOf("function");
    expect(prepareLmstudioDynamicModels).toBeTypeOf("function");
    expect(promptAndConfigureLmstudioInteractive).toBeTypeOf("function");
  });
});
