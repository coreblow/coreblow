/** CoreBlow — CLI DotEnv */ import { loadDotEnv } from "../infra/dotenv.js"; export function loadCliDotEnv(): void { loadDotEnv(undefined, { quiet: true }); }
