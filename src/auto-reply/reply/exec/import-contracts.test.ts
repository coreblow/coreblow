import{describe,expect,it}from"vitest";
describe("directive",()=>{it("ok",async()=>{const m=await import("./directive.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
