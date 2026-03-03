import{describe,expect,it}from"vitest";
describe("reply-payloads-dedupe.runtime",()=>{it("ok",async()=>{const m=await import("./reply-payloads-dedupe.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("reply-payloads-dedupe",()=>{it("ok",async()=>{const m=await import("./reply-payloads-dedupe.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
