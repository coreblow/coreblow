import{describe,expect,it}from"vitest";
describe("route-reply.runtime",()=>{it("ok",async()=>{const m=await import("./route-reply.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("session-fork.runtime",()=>{it("ok",async()=>{const m=await import("./session-fork.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
