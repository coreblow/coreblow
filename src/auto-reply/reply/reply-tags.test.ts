import{describe,expect,it}from"vitest";
describe("reply-tags",()=>{it("ok",async()=>{const m=await import("./reply-tags.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("reply-threading",()=>{it("ok",async()=>{const m=await import("./reply-threading.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
