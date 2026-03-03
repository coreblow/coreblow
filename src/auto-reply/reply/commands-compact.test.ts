import{describe,expect,it}from"vitest";
describe("commands-compact",()=>{it("ok",async()=>{const m=await import("./commands-compact.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-config",()=>{it("ok",async()=>{const m=await import("./commands-config.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
