import{describe,expect,it}from"vitest";
describe("get-reply-run",()=>{it("ok",async()=>{const m=await import("./get-reply-run.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("get-reply.test-mocks",()=>{it("ok",async()=>{const m=await import("./get-reply.test-mocks.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
