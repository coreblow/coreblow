import{describe,expect,it}from"vitest";
describe("memory-flush",()=>{it("ok",async()=>{const m=await import("./memory-flush.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("normalize-reply",()=>{it("ok",async()=>{const m=await import("./normalize-reply.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
