import { ErrorCodes, errorShape, validateToolsCatalogParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// Basic CoreBlow representation of tools catalog
const CORE_TOOLS = [
    { id: "read_file", label: "Read File", description: "Read contents of a file", source: "core", defaultProfiles: ["coding"] },
    { id: "write_file", label: "Write File", description: "Write contents to a file", source: "core", defaultProfiles: ["coding"] },
    { id: "run_command", label: "Run Command", description: "Execute a CLI command", source: "core", defaultProfiles: ["coding", "full"] },
];

export const toolsCatalogHandlers: GatewayRequestHandlers = {
    "tools.catalog": ({ params, respond }) => {
        if (!validateToolsCatalogParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid params"));
            return;
        }

        respond(true, {
            agentId: (params as any).agentId || "coreblow_builtin",
            profiles: [
                { id: "minimal", label: "Minimal" },
                { id: "coding", label: "Coding Assistant" },
                { id: "full", label: "Full Powers" }
            ],
            groups: [
                {
                    id: "core",
                    label: "Core Capabilities",
                    source: "core",
                    tools: CORE_TOOLS
                }
            ]
        }, undefined);
    }
};
