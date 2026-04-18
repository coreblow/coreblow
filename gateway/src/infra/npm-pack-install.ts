/** CoreBlow — NPM Pack Install */
import { execFileSync } from "node:child_process";
export function npmPack(packageDir: string, outputDir: string): string { return execFileSync("npm", ["pack", "--pack-destination", outputDir], { cwd: packageDir, encoding: "utf8", timeout: 30000 }).trim(); }
