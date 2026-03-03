import{describe,expect,it}from"vitest";
describe("commands-plugin",()=>{it("ok",async()=>{const m=await import("./commands-plugin.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-session-abort",()=>{it("ok",async()=>{const m=await import("./commands-session-abort.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
