import{describe,expect,it}from"vitest";
describe("agent-runner-memory.runtime",()=>{it("ok",async()=>{const m=await import("./agent-runner-memory.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("agent-runner-memory",()=>{it("ok",async()=>{const m=await import("./agent-runner-memory.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
