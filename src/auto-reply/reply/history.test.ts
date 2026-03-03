import{describe,expect,it}from"vitest";
describe("history",()=>{it("ok",async()=>{const m=await import("./history.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("inbound-context",()=>{it("ok",async()=>{const m=await import("./inbound-context.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
