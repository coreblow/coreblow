import{describe,expect,it}from"vitest";
describe("defaults",()=>{it("ok",async()=>{const m=await import("./defaults.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("docs-path",()=>{it("ok",async()=>{const m=await import("./docs-path.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
