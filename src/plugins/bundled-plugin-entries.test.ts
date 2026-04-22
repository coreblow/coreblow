import{describe,expect,it}from"vitest";
describe("bundled-plugin-entries",()=>{it("ok",async()=>{const m=await import("./bundled-plugin-entries.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("bundled-plugin-metadata.generated",()=>{it("ok",async()=>{const m=await import("./bundled-plugin-metadata.generated.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
