/**
 * @coreblow/plugin-sdk
 *
 * Canonical Unified Plugin SDK entrypoint.
 * Re-exports the thematic domain barrels from `src/plugin-sdk/`:
 *  - channel:  Channel lifecycle, envelope, pairing, status, and routing facades
 *  - provider: Provider catalog, auth, DOP OpenAI-compatible streaming engine
 *  - tool:     Tool parameters, schemas, symbols, and metadata contracts
 *  - memory:   Cory built-in memory system, orchestrator, and root memory helpers
 *  - approval: Execution approval forwarder, lifecycle, and security contracts
 */

export * as channel from "../../../src/plugin-sdk/channel.js";
export * as provider from "../../../src/plugin-sdk/provider.js";
export * as tool from "../../../src/plugin-sdk/tool.js";
export * as memory from "../../../src/plugin-sdk/memory.js";
export * as approval from "../../../src/plugin-sdk/approval.js";

// Direct flat re-exports for the thematic domains to eliminate SDK drift
export * from "../../../src/plugin-sdk/channel.js";
export * from "../../../src/plugin-sdk/provider.js";
export * from "../../../src/plugin-sdk/tool.js";
export * from "../../../src/plugin-sdk/memory.js";
export * from "../../../src/plugin-sdk/approval.js";
