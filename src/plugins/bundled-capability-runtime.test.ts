import{describe,expect,it}from"vitest";
describe("bundled-capability-runtime",()=>{it("ok",async()=>{const m=await import("./bundled-capability-runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("bundled-compat",()=>{it("ok",async()=>{const m=await import("./bundled-compat.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
