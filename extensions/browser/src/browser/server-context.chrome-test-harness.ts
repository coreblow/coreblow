import { vi } from "vitest";
import { installChromeUserDataDirHooks } from "./chrome-user-data-dir.test-harness.js";

const chromeUserDataDir = { dir: "/tmp/coreblow" };
installChromeUserDataDirHooks(chromeUserDataDir);

vi.mock("./chrome.js", () => ({
  isChromeCdpReady: vi.fn(async () => true),
  isChromeReachable: vi.fn(async () => true),
  launchCoreBlowChrome: vi.fn(async () => {
    throw new Error("unexpected launch");
  }),
  resolveCoreBlowUserDataDir: vi.fn(() => chromeUserDataDir.dir),
  stopCoreBlowChrome: vi.fn(async () => {}),
}));
