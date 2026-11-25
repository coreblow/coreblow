import { vi } from "vitest";

vi.mock("./accounts.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./accounts.js")>();
  const { createBlueBubblesAccountsMockModule } = await import("./test-harness.js");
  return {
    ...actual,
    ...createBlueBubblesAccountsMockModule(),
  };
});

vi.mock("./probe.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./probe.js")>();
  const { createBlueBubblesProbeMockModule } = await import("./test-harness.js");
  return {
    ...actual,
    ...createBlueBubblesProbeMockModule(),
  };
});
