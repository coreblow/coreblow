import {
  draftGoalContractText,
  GoalContractStore,
  parseGoalCommand,
} from "../../agents/goals/index.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function withStore<T>(fn: (store: GoalContractStore) => T): T {
  const store = new GoalContractStore();
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

export const goalsHandlers: GatewayRequestHandlers = {
  "goals.list": ({ params, respond }) => {
    const sessionId = typeof params?.sessionId === "string" ? params.sessionId.trim() : undefined;
    const contracts = withStore((store) => store.listContracts(sessionId || undefined));
    respond(true, { contracts }, undefined);
  },
  "goals.get": ({ params, respond }) => {
    const id = typeof params?.id === "string" ? params.id.trim() : "";
    const sessionId = typeof params?.sessionId === "string" ? params.sessionId.trim() : "";
    const contract = withStore((store) =>
      id ? store.getById(id) : sessionId ? store.getLatestForSession(sessionId) : null,
    );
    respond(true, { contract }, undefined);
  },
  "goals.draft": ({ params, respond }) => {
    const objective = typeof params?.objective === "string" ? params.objective.trim() : "";
    if (!objective) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "objective required"));
      return;
    }
    respond(true, draftGoalContractText(objective), undefined);
  },
  "goals.set": ({ params, respond }) => {
    const sessionId = typeof params?.sessionId === "string" ? params.sessionId.trim() : "main";
    const objective = typeof params?.objective === "string" ? params.objective.trim() : "";
    if (!objective) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "objective required"));
      return;
    }
    const acceptanceCriteria = Array.isArray(params?.acceptanceCriteria)
      ? params.acceptanceCriteria.map(String)
      : undefined;
    const gateCommands = Array.isArray(params?.gateCommands)
      ? params.gateCommands.map(String)
      : undefined;
    const maxIterations =
      typeof params?.maxIterations === "number" ? params.maxIterations : undefined;
    const contract = withStore((store) =>
      store.createOrReplaceForSession({
        sessionId,
        objective,
        acceptanceCriteria,
        gateCommands,
        maxIterations,
      }),
    );
    respond(true, { contract }, undefined);
  },
  "goals.wait": ({ params, respond }) => {
    const sessionId = typeof params?.sessionId === "string" ? params.sessionId.trim() : "main";
    const pid = typeof params?.pid === "number" ? params.pid : Number.NaN;
    if (!Number.isInteger(pid) || pid <= 0) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "valid pid required"));
      return;
    }
    const updated = withStore((store) => {
      const latest = store.getLatestForSession(sessionId);
      if (!latest) {
        return null;
      }
      return store.update(latest.id, { status: "waiting", waitPid: pid });
    });
    respond(true, { contract: updated }, undefined);
  },
  "goals.cancel": ({ params, respond }) => {
    const sessionId = typeof params?.sessionId === "string" ? params.sessionId.trim() : "main";
    const id = typeof params?.id === "string" ? params.id.trim() : "";
    const updated = withStore((store) => {
      const target = id ? store.getById(id) : store.getLatestForSession(sessionId);
      if (!target) {
        return null;
      }
      return store.update(target.id, { status: "cancelled" });
    });
    respond(true, { contract: updated }, undefined);
  },
  "goals.command": ({ params, respond }) => {
    const rawArgs = typeof params?.args === "string" ? params.args : "";
    const parsed = parseGoalCommand(rawArgs);
    respond(true, parsed, undefined);
  },
};
