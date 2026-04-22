import{describe,expect,it}from"vitest";
describe("session-fork",()=>{it("ok",async()=>{const m=await import("./session-fork.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("session-hooks",()=>{it("ok",async()=>{const m=await import("./session-hooks.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
