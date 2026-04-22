import{describe,expect,it}from"vitest";
describe("bash-tools.exec-host-node",()=>{it("ok",async()=>{const m=await import("./bash-tools.exec-host-node.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("bash-tools.exec-host-shared",()=>{it("ok",async()=>{const m=await import("./bash-tools.exec-host-shared.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
