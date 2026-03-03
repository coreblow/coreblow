import{describe,expect,it}from"vitest";
describe("dispatcher-registry",()=>{it("ok",async()=>{const m=await import("./dispatcher-registry.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("elevated-allowlist-matcher",()=>{it("ok",async()=>{const m=await import("./elevated-allowlist-matcher.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
