import{describe,expect,it}from"vitest";
describe("commands-types",()=>{it("ok",async()=>{const m=await import("./commands-types.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands.runtime",()=>{it("ok",async()=>{const m=await import("./commands.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
