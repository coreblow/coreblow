/**
 * Type stubs for optional channel dependencies
 * These packages are only needed when using specific channels
 * Install the ones you need: npm install discord.js
 */

declare module 'discord.js' {
    export class Client {
        constructor(options: any);
        login(token: string): Promise<string>;
        on(event: string, handler: (...args: any[]) => void): this;
        destroy(): Promise<void>;
        user: { tag: string } | null;
    }
    export const GatewayIntentBits: Record<string, number>;
    export const Partials: Record<string, number>;
}

declare module 'irc-framework' {
    export class Client {
        constructor();
        connect(options: any): void;
        on(event: string, handler: (...args: any[]) => void): this;
        say(target: string, message: string): void;
        quit(message?: string): void;
    }
}

declare module 'matrix-js-sdk' {
    export function createClient(options: any): any;
}

declare module '@slack/bolt' {
    export class App {
        constructor(options: any);
        start(port?: number): Promise<void>;
        stop(): Promise<void>;
        message(handler: (...args: any[]) => void): void;
        event(event: string, handler: (...args: any[]) => void): void;
    }
}

declare module '@whiskeysockets/baileys' {
    export function makeWASocket(options: any): any;
    export function useMultiFileAuthState(path: string): Promise<any>;
    export function DisconnectReason(): any;
    export function fetchLatestBaileysVersion(): Promise<any>;
}

declare module '@line/bot-sdk' {
    export class Client {
        constructor(options: any);
        pushMessage(to: string, messages: any): Promise<any>;
        replyMessage(replyToken: string, messages: any): Promise<any>;
    }
    export function middleware(config: any): any;
}

declare module 'botframework-connector' {
    export class MicrosoftAppCredentials {
        constructor(appId: string, appPassword: string);
    }
    export class ConnectorClient {
        constructor(credentials: any, options: any);
        conversations: any;
    }
}
