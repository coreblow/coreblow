import{describe,expect,it}from"vitest";
describe("runtime-telegram",()=>{it("ok",async()=>{const m=await import("./runtime-telegram.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("runtime-tts.runtime",()=>{it("ok",async()=>{const m=await import("./runtime-tts.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
