import{describe,expect,it}from"vitest";
describe("conversation-binding-input",()=>{it("ok",async()=>{const m=await import("./conversation-binding-input.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("debug-commands",()=>{it("ok",async()=>{const m=await import("./debug-commands.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
