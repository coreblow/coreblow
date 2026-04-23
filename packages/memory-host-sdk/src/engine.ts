/**
 * Aggregate entry point for the CoreBlow memory engine surface.
 *
 * Consumers should prefer importing from focused subpaths
 * (e.g. `./engine-foundation.js`) for new code to keep
 * dependency graphs narrow. This barrel exists for convenience
 * when the full engine API is needed.
 */

export * from "./engine-foundation.js";
export * from "./engine-storage.js";
export * from "./engine-embeddings.js";
export * from "./engine-qmd.js";
