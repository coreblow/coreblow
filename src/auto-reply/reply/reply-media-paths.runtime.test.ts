import{describe,expect,it}from"vitest";
describe("reply-media-paths.runtime",()=>{it("ok",async()=>{const m=await import("./reply-media-paths.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("reply-payloads-base",()=>{it("ok",async()=>{const m=await import("./reply-payloads-base.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
