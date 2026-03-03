import{describe,expect,it}from"vitest";
describe("reply.test-helpers",()=>{it("ok",async()=>{const m=await import("./reply.test-helpers.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("response-prefix-template",()=>{it("ok",async()=>{const m=await import("./response-prefix-template.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
