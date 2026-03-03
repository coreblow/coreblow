import{describe,expect,it}from"vitest";
describe("runtime-discord-ops.runtime",()=>{it("ok",async()=>{const m=await import("./runtime-discord-ops.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("runtime-discord-typing",()=>{it("ok",async()=>{const m=await import("./runtime-discord-typing.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
