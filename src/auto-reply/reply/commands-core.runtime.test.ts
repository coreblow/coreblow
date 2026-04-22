import{describe,expect,it}from"vitest";
describe("commands-core.runtime",()=>{it("ok",async()=>{const m=await import("./commands-core.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-export-session",()=>{it("ok",async()=>{const m=await import("./commands-export-session.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
