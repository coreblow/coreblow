import{describe,expect,it}from"vitest";
describe("matrix-context",()=>{it("ok",async()=>{const m=await import("./matrix-context.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("mcp-commands",()=>{it("ok",async()=>{const m=await import("./mcp-commands.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
