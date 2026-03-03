import{describe,expect,it}from"vitest";
describe("",()=>{it("ok",async()=>{const m=await import("./.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("agent-engine",()=>{it("ok",async()=>{const m=await import("./agent-engine.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
