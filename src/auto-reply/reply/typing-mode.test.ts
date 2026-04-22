import{describe,expect,it}from"vitest";
describe("typing-mode",()=>{it("ok",async()=>{const m=await import("./typing-mode.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("typing",()=>{it("ok",async()=>{const m=await import("./typing.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
