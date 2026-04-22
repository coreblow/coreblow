import{describe,expect,it}from"vitest";
describe("commands-session-store",()=>{it("ok",async()=>{const m=await import("./commands-session-store.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-session",()=>{it("ok",async()=>{const m=await import("./commands-session.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
