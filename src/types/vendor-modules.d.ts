declare module "qrcode-terminal" {
  export function generate(...args: unknown[]): void;
}

declare module "markdown-it" {
  export interface Token {
    type: string;
    tag: string;
    attrs: [string, string][] | null;
    map: [number, number] | null;
    nesting: number;
    level: number;
    children: Token[] | null;
    content: string;
    markup: string;
    info: string;
    meta: unknown;
    block: boolean;
    hidden: boolean;
    attrIndex(name: string): number;
    attrPush(attrData: [string, string]): void;
    attrSet(name: string, value: string): void;
    attrGet(name: string): string | null;
    attrJoin(name: string, value: string): void;
    constructor: new (type: string, tag: string, nesting: number) => Token;
  }

  export interface Renderer {
    rules: Record<string, (tokens: Token[], idx: number, options: Record<string, unknown>, env: unknown, self: Renderer) => string>;
    render(tokens: Token[], options: Record<string, unknown>, env: unknown): string;
    renderToken(tokens: Token[], idx: number, options: Record<string, unknown>): string;
  }

  class MarkdownIt {
    constructor(presetName?: string | Record<string, unknown>, options?: Record<string, unknown>);
    enable(...args: unknown[]): this;
    disable(...args: unknown[]): this;
    render(src: string, env?: unknown): string;
    parse(src: string, env?: unknown): Token[];
    renderer: Renderer;
    options: Record<string, unknown>;
    utils: {
      escapeHtml(str: string): string;
      [key: string]: unknown;
    };
  }

  export = MarkdownIt;
}

declare module "@openclaw/proxyline" {
  export type ProxylineUndiciOptions = {
    allowH2?: boolean;
  };
  export type ProxylineHandle = {
    stop(): void;
    registerBypass(options: { url: string }): () => void;
  };
  export function installGlobalProxy(options: {
    mode?: string;
    proxyUrl: string;
    proxyTls?: { ca?: string };
    ifActive?: string;
    undici?: ProxylineUndiciOptions;
  }): ProxylineHandle;
}

declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;

  export function sendNotification(
    pushSubscription: PushSubscription,
    payload: string,
  ): Promise<{ statusCode: number }>;

  const webPush: {
    generateVAPIDKeys: typeof generateVAPIDKeys;
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export default webPush;
}
