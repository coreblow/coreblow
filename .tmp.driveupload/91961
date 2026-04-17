import type { RpcResponder } from "../gateway-types.js";

export function respondInvalidParams({ respond, method }: { respond: RpcResponder, method: string }) {
    respond({ ok: false, error: { code: "INVALID_PARAMS", message: `Invalid params for ${method}` } });
}

export async function respondUnavailableOnThrow(respond: RpcResponder, block: () => Promise<void>) {
    try {
        await block();
    } catch (err: unknown) {
        respond({ ok: false, error: { code: "UNAVAILABLE", message: (err instanceof Error ? err.message : String(err)) } });
    }
}
