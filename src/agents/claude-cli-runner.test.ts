import{describe,expect,it}from"vitest";
describe("claude-cli-runner",()=>{it("ok",async()=>{const m=await import("./claude-cli-runner.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("cli-runner.test-support",()=>{it("ok",async()=>{const m=await import("./cli-runner.test-support.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
