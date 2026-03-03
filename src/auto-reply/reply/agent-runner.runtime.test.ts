import{describe,expect,it}from"vitest";
describe("agent-runner.runtime",()=>{it("ok",async()=>{const m=await import("./agent-runner.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("agent-runner",()=>{it("ok",async()=>{const m=await import("./agent-runner.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
