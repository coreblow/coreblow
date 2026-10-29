// Narrow entry point for setSlackRuntime — avoids pulling in the full
// runtime-api barrel during plugin register().
export { setSlackRuntime } from "./src/runtime.js";
