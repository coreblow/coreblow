#!/usr/bin/env node
import { createPatchPlan } from "./plan.mjs";

const title = process.argv.find((arg) => arg.startsWith("--title="))?.slice("--title=".length);
const risk = process.argv.find((arg) => arg.startsWith("--risk="))?.slice("--risk=".length);

console.log(JSON.stringify(createPatchPlan({ title, risk }), null, 2));
