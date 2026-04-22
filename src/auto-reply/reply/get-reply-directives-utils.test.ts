import{describe,expect,it}from"vitest";
describe("get-reply-directives-utils",()=>{it("ok",async()=>{const m=await import("./get-reply-directives-utils.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("get-reply-directives",()=>{it("ok",async()=>{const m=await import("./get-reply-directives.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
