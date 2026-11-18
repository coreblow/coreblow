import type { CoreBlowDesktopApi } from "../../electron/preload";

declare global {
  interface Window {
    coreblowDesktop?: CoreBlowDesktopApi;
  }
}

export {};
