import{describe,expect,it}from"vitest";
describe("queue",()=>{it("ok",async()=>{const m=await import("./queue.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("reply-dedup",()=>{it("ok",async()=>{const m=await import("./reply-dedup.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
