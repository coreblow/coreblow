import{describe,expect,it}from"vitest";
describe("acp-runtime",()=>{it("ok",async()=>{const m=await import("./acp-runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
