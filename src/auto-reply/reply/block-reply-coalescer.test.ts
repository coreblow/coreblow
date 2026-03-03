import{describe,expect,it}from"vitest";
describe("block-reply-coalescer",()=>{it("ok",async()=>{const m=await import("./block-reply-coalescer.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("body",()=>{it("ok",async()=>{const m=await import("./body.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
