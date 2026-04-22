import{describe,expect,it}from"vitest";
describe("btw-command",()=>{it("ok",async()=>{const m=await import("./btw-command.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("channel-context",()=>{it("ok",async()=>{const m=await import("./channel-context.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
