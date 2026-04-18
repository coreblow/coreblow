/** CoreBlow — WS Message Handler */ export type WsMessageHandler = (connectionId: string, message: unknown) => Promise<void>;
