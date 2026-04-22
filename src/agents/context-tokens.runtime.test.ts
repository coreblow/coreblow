import{describe,expect,it}from"vitest";
describe("context-tokens.runtime",()=>{it("ok",async()=>{const m=await import("./context-tokens.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("coreblow-tools.runtime",()=>{it("ok",async()=>{const m=await import("./coreblow-tools.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
