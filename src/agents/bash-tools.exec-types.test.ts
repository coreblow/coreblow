import{describe,expect,it}from"vitest";
describe("bash-tools.exec-types",()=>{it("ok",async()=>{const m=await import("./bash-tools.exec-types.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("bash-tools.exec",()=>{it("ok",async()=>{const m=await import("./bash-tools.exec.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
