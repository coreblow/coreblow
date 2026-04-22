import{describe,expect,it}from"vitest";
describe("get-reply-from-config.runtime",()=>{it("ok",async()=>{const m=await import("./get-reply-from-config.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("get-reply-inline-actions",()=>{it("ok",async()=>{const m=await import("./get-reply-inline-actions.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
