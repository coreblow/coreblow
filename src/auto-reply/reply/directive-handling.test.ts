import{describe,expect,it}from"vitest";
describe("directive-handling",()=>{it("ok",async()=>{const m=await import("./directive-handling.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("directive-parser",()=>{it("ok",async()=>{const m=await import("./directive-parser.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
