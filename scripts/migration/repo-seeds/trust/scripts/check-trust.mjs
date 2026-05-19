import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("threats.json", "utf8"));
if (data.product !== "CoreBlow") {
  throw new Error("threats.json must describe CoreBlow");
}
if (!Array.isArray(data.threats) || data.threats.length === 0) {
  throw new Error("threats.json must list at least one threat");
}
for (const threat of data.threats) {
  for (const key of ["id", "owner", "severity", "summary"]) {
    if (!threat[key]) {
      throw new Error(`Threat entry is missing ${key}`);
    }
  }
}
console.log(`Checked ${data.threats.length} trust entries.`);
