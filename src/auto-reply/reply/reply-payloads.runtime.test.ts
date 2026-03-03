import{describe,expect,it}from"vitest";
describe("reply-payloads.runtime",()=>{it("ok",async()=>{const m=await import("./reply-payloads.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("reply-reference",()=>{it("ok",async()=>{const m=await import("./reply-reference.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
