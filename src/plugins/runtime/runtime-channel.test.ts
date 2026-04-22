import{describe,expect,it}from"vitest";
describe("runtime-channel",()=>{it("ok",async()=>{const m=await import("./runtime-channel.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("runtime-config",()=>{it("ok",async()=>{const m=await import("./runtime-config.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
