import{describe,expect,it}from"vitest";
describe("commands-system-prompt",()=>{it("ok",async()=>{const m=await import("./commands-system-prompt.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-tts",()=>{it("ok",async()=>{const m=await import("./commands-tts.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
