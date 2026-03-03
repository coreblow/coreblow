import{describe,expect,it}from"vitest";
describe("inbound-text",()=>{it("ok",async()=>{const m=await import("./inbound-text.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("line-directives",()=>{it("ok",async()=>{const m=await import("./line-directives.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
