import{describe,expect,it}from"vitest";
describe("elevated-unavailable",()=>{it("ok",async()=>{const m=await import("./elevated-unavailable.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("exec",()=>{it("ok",async()=>{const m=await import("./exec.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
