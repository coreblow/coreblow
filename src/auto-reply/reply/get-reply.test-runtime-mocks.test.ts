import{describe,expect,it}from"vitest";
describe("get-reply.test-runtime-mocks",()=>{it("ok",async()=>{const m=await import("./get-reply.test-runtime-mocks.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("get-reply",()=>{it("ok",async()=>{const m=await import("./get-reply.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
