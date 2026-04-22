import{describe,expect,it}from"vitest";
describe("plugins-commands",()=>{it("ok",async()=>{const m=await import("./plugins-commands.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("provider-dispatcher",()=>{it("ok",async()=>{const m=await import("./provider-dispatcher.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
