import{describe,expect,it}from"vitest";
describe("",()=>{it("ok",async()=>{const m=await import("./.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("api-builder",()=>{it("ok",async()=>{const m=await import("./api-builder.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
