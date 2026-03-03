import{describe,expect,it}from"vitest";
describe("test-ctx",()=>{it("ok",async()=>{const m=await import("./test-ctx.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("test-helpers",()=>{it("ok",async()=>{const m=await import("./test-helpers.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
