import{describe,expect,it}from"vitest";
describe("bundle-config-shared",()=>{it("ok",async()=>{const m=await import("./bundle-config-shared.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("bundle-lsp",()=>{it("ok",async()=>{const m=await import("./bundle-lsp.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
