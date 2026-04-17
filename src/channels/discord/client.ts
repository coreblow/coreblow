/**
 * Discord Client Factory
 */
export interface ClientOptions {
    token: string;
    onError?: (err: Error) => void;
}
export async function createClient(_opts: ClientOptions): Promise<unknown> { return {}; }
export async function loginClient(_client: unknown, _token: string): Promise<void> {}
export function destroyClient(_client: unknown): void {}
