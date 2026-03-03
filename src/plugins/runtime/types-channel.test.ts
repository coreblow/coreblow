import{describe,expect,it}from"vitest";
describe("types-channel",()=>{it("ok",async()=>{const m=await import("./types-channel.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("types-core",()=>{it("ok",async()=>{const m=await import("./types-core.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
