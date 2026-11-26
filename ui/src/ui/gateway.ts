import { generateUUID } from "./uuid.ts";

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server?: { version?: string; connId?: string };
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

const DEVICE_IDENTITY_STORAGE_KEY = "coreblow.control.device.ed25519.v1";

type StoredBrowserDeviceKey = {
  deviceId: string;
  publicKey: string;
  privateJwk: JsonWebKey;
};

type BrowserDeviceKey = StoredBrowserDeviceKey & {
  privateKey: CryptoKey;
};

let cachedBrowserDeviceKeyPromise: Promise<BrowserDeviceKey | null> | null = null;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadOrCreateBrowserDeviceKey(): Promise<BrowserDeviceKey | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return null;
  }
  try {
    const storedRaw = globalThis.localStorage?.getItem(DEVICE_IDENTITY_STORAGE_KEY);
    if (storedRaw) {
      const parsed = JSON.parse(storedRaw) as Partial<StoredBrowserDeviceKey>;
      if (parsed.deviceId && parsed.publicKey && parsed.privateJwk) {
        const privateKey = await crypto.subtle.importKey(
          "jwk",
          parsed.privateJwk,
          { name: "Ed25519" },
          false,
          ["sign"],
        );
        return {
          deviceId: parsed.deviceId,
          publicKey: parsed.publicKey,
          privateJwk: parsed.privateJwk,
          privateKey,
        };
      }
    }
    const generated = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", generated.publicKey));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", rawPub));
    const deviceId = toHex(digest);
    const publicKey = toBase64Url(rawPub);
    const privateJwk = (await crypto.subtle.exportKey("jwk", generated.privateKey)) as JsonWebKey;
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateJwk,
      { name: "Ed25519" },
      false,
      ["sign"],
    );
    try {
      globalThis.localStorage?.setItem(
        DEVICE_IDENTITY_STORAGE_KEY,
        JSON.stringify({ deviceId, publicKey, privateJwk }),
      );
    } catch {}
    return { deviceId, publicKey, privateJwk, privateKey };
  } catch {
    return null;
  }
}

async function getBrowserDeviceKey(): Promise<BrowserDeviceKey | null> {
  if (!cachedBrowserDeviceKeyPromise) {
    cachedBrowserDeviceKeyPromise = loadOrCreateBrowserDeviceKey();
  }
  return cachedBrowserDeviceKeyPromise;
}

async function buildControlUiConnectDevice(params: {
  nonce: string;
  token?: string;
  role: string;
  scopes: string[];
}): Promise<
  | {
      id: string;
      publicKey: string;
      signature: string;
      signedAt: number;
      nonce: string;
    }
  | undefined
> {
  if (!params.nonce) return undefined;
  const key = await getBrowserDeviceKey();
  if (!key) return undefined;
  const signedAt = Date.now();
  const payload = [
    "v3",
    key.deviceId,
    "coreblow-control-ui",
    "ui",
    params.role,
    params.scopes.join(","),
    String(signedAt),
    params.token ?? "",
    params.nonce,
    "web",
    "",
  ].join("|");
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign(
      { name: "Ed25519" },
      key.privateKey,
      new TextEncoder().encode(payload),
    ),
  );
  return {
    id: key.deviceId,
    publicKey: key.publicKey,
    signature: toBase64Url(sigBytes),
    signedAt,
    nonce: params.nonce,
  };
}

export class GatewayBrowserClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private connectSent = false;

  constructor(private opts: GatewayBrowserClientOptions) {}

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.closed) return;
    this.ws = new WebSocket(this.opts.url);
    this.ws.addEventListener("open", () => {
      this.connectSent = false;
    });
    this.ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data ?? "")));
    this.ws.addEventListener("close", (ev) => {
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code})`));
      this.opts.onClose?.({ code: ev.code, reason: ev.reason });

      // Basic reconnect backoff
      if (!this.closed) {
        setTimeout(() => this.connect(), 2000);
      }
    });
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private handleMessage(raw: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (parsed.type === "event") {
      if (parsed.event === "connect.challenge" && !this.connectSent) {
        this.connectSent = true;
        const nonce = typeof parsed.payload?.nonce === "string" ? parsed.payload.nonce : "";
        const role = "operator";
        const scopes = ["operator.admin"];
        void buildControlUiConnectDevice({
          nonce,
          token: this.opts.token,
          role,
          scopes,
        })
          .then((device) =>
            this.request<GatewayHelloOk>("connect", {
              minProtocol: 3,
              maxProtocol: 3,
              client: { id: "coreblow-control-ui", version: "2.3.1", platform: "web", mode: "ui" },
              role,
              scopes,
              ...(device ? { device } : {}),
              ...(this.opts.token ? { auth: { token: this.opts.token } } : {}),
              userAgent: navigator.userAgent,
            }),
          )
          .then((hello) => {
            this.opts.onHello?.(hello);
          })
          .catch((err) => {
            console.error("Connect failed", err);
          });
        return;
      }
      this.opts.onEvent?.(parsed as GatewayEventFrame);
      return;
    }

    if (parsed.type === "res") {
      const pending = this.pending.get(parsed.id);
      if (!pending) return;
      this.pending.delete(parsed.id);
      if (parsed.ok) {
        pending.resolve(parsed.payload);
      } else {
        pending.reject(new Error(parsed.error?.message || "gateway request failed"));
      }
      return;
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = generateUUID();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }
}
