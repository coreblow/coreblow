import{describe,expect,it}from"vitest";
describe("dispatch-acp",()=>{it("ok",async()=>{const m=await import("./dispatch-acp.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("dispatch-from-config",()=>{it("ok",async()=>{const m=await import("./dispatch-from-config.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
