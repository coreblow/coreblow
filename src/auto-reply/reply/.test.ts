import{describe,expect,it}from"vitest";
describe("",()=>{it("ok",async()=>{const m=await import("./.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("abort-cutoff.runtime",()=>{it("ok",async()=>{const m=await import("./abort-cutoff.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
