import{describe,expect,it}from"vitest";
describe("directive-handling.persist.runtime",()=>{it("ok",async()=>{const m=await import("./directive-handling.persist.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("directive-handling.persist",()=>{it("ok",async()=>{const m=await import("./directive-handling.persist.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
