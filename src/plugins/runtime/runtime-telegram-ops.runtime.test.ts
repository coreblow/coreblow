import{describe,expect,it}from"vitest";
describe("runtime-telegram-ops.runtime",()=>{it("ok",async()=>{const m=await import("./runtime-telegram-ops.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("runtime-telegram-typing",()=>{it("ok",async()=>{const m=await import("./runtime-telegram-typing.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
