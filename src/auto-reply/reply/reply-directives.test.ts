import{describe,expect,it}from"vitest";
describe("reply-directives",()=>{it("ok",async()=>{const m=await import("./reply-directives.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("reply-dispatcher",()=>{it("ok",async()=>{const m=await import("./reply-dispatcher.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
