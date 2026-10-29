declare module "qrcode-terminal" {
  export function generate(...args: unknown[]): void;
}

declare module "markdown-it" {
  class MarkdownIt {
    constructor(...args: unknown[]);
    enable(...args: unknown[]): this;
    disable(...args: unknown[]): this;
    render(...args: unknown[]): string;
    parse(...args: unknown[]): unknown[];
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
