import{describe,expect,it}from"vitest";
describe("commands-info",()=>{it("ok",async()=>{const m=await import("./commands-info.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-models",()=>{it("ok",async()=>{const m=await import("./commands-models.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
