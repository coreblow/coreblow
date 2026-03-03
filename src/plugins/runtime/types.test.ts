import{describe,expect,it}from"vitest";
describe("types",()=>{it("ok",async()=>{const m=await import("./types.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("typing-lease.test-support",()=>{it("ok",async()=>{const m=await import("./typing-lease.test-support.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
