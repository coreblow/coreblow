#!/usr/bin/env node
import { createRunPlan } from "./plan.mjs";

const stepsArg = process.argv.find((arg) => arg.startsWith("--steps="));
const steps = stepsArg ? stepsArg.slice("--steps=".length).split(",").filter(Boolean) : undefined;

console.log(JSON.stringify(createRunPlan({ steps }), null, 2));
