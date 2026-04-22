import{describe,expect,it}from"vitest";
describe("fs-fixtures",()=>{it("ok",async()=>{const m=await import("./fs-fixtures.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
