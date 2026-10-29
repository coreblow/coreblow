import { loadConfig } from "../config/io.js";

export function getRuntimeConfig() {
  return loadConfig();
}
