/** CoreBlow — Update Global */
import { execFileSync } from "node:child_process";
export function updateGlobalPackage(packageName = "coreblow"): boolean { try { execFileSync("npm", ["install", "-g", packageName + "@latest"], { encoding: "utf8", timeout: 120000 }); return true; } catch { return false; } }
