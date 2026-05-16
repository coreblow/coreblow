/**
 * Lit reactive controller for i18n.
 *
 * Attach to any LitElement to automatically re-render when the locale changes.
 *
 * Usage:
 *   class MyElement extends LitElement {
 *     private i18nCtrl = new I18nController(this);
 *     render() { return html`${t("nav.chat")}`; }
 *   }
 */

import type { ReactiveController, ReactiveControllerHost } from "lit";
import { i18n } from "./translate.ts";

export class I18nController implements ReactiveController {
  private host: ReactiveControllerHost;
  private unsubscribe?: () => void;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    this.host.addController(this);
  }

  hostConnected() {
    this.unsubscribe = i18n.subscribe(() => {
      this.host.requestUpdate();
    });
  }

  hostDisconnected() {
    this.unsubscribe?.();
  }
}
