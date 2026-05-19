import { existsSync, readFileSync } from "node:fs";

const required = ["README.md", "rules.md", "roles.md", "onboarding.md", "incident-playbook.md"];
const missing = required.filter((file) => !existsSync(file));
if (missing.length > 0) {
  throw new Error(`Missing required docs: ${missing.join(", ")}`);
}

for (const file of required) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("CoreBlow") && file !== "incident-playbook.md") {
    throw new Error(`${file} must mention CoreBlow`);
  }
}

console.log(`Checked ${required.length} community docs.`);
