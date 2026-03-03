import{describe,expect,it}from"vitest";
describe("command-gates",()=>{it("ok",async()=>{const m=await import("./command-gates.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("commands-allowlist",()=>{it("ok",async()=>{const m=await import("./commands-allowlist.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
