import { AcpRuntimeError } from "../runtime/errors.js";
import type { AcpRuntime, AcpRuntimeEvent, AcpRuntimeTurnInput } from "../runtime/types.js";
import { normalizeAcpErrorCode } from "./manager.utils.js";

export type AcpTurnEventGate = { open: boolean };

export type AcpTurnStreamOutcome = {
  sawOutput: boolean;
  sawTerminalEvent: boolean;
};

export async function consumeAcpTurnStream(params: {
  runtime: AcpRuntime;
  turn: AcpRuntimeTurnInput;
  eventGate: AcpTurnEventGate;
  onEvent?: (event: AcpRuntimeEvent) => Promise<void> | void;
  onOutputEvent?: (
    event: Extract<AcpRuntimeEvent, { type: "text_delta" | "tool_call" }>,
  ) => Promise<void> | void;
}): Promise<AcpTurnStreamOutcome> {
  let streamError: AcpRuntimeError | undefined;
  let sawOutput = false;
  let sawTerminalEvent = false;

  for await (const event of params.runtime.runTurn(params.turn)) {
    if (!params.eventGate.open) {
      continue;
    }
    if (event.type === "done") {
      sawTerminalEvent = true;
    } else if (event.type === "error") {
      streamError = new AcpRuntimeError(
        normalizeAcpErrorCode(event.code),
        event.message.trim() || "ACP turn failed before completion.",
      );
    } else if (event.type === "text_delta" || event.type === "tool_call") {
      sawOutput = true;
      await params.onOutputEvent?.(event);
    }
    await params.onEvent?.(event);
  }

  if (params.eventGate.open && streamError) {
    throw streamError;
  }
  return { sawOutput, sawTerminalEvent };
}
