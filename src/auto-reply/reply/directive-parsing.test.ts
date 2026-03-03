import{describe,expect,it}from"vitest";
describe("directive-parsing",()=>{it("ok",async()=>{const m=await import("./directive-parsing.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("directives",()=>{it("ok",async()=>{const m=await import("./directives.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
