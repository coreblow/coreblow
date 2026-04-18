/** CoreBlow — Outbound Payloads */
export type PayloadType = "text" | "image" | "file" | "card" | "action";
export interface BasePayload { type: PayloadType; }
export interface TextPayload extends BasePayload { type: "text"; text: string; }
export interface ImagePayload extends BasePayload { type: "image"; url: string; alt?: string; }
export type OutboundPayload = TextPayload | ImagePayload;
