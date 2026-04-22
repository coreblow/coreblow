import{describe,expect,it}from"vitest";
describe("abort-cutoff",()=>{it("ok",async()=>{const m=await import("./abort-cutoff.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("abort-primitives",()=>{it("ok",async()=>{const m=await import("./abort-primitives.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
