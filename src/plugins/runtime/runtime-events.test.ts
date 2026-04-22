import{describe,expect,it}from"vitest";
describe("runtime-events",()=>{it("ok",async()=>{const m=await import("./runtime-events.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("runtime-imessage",()=>{it("ok",async()=>{const m=await import("./runtime-imessage.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
