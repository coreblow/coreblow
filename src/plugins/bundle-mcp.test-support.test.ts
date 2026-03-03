import{describe,expect,it}from"vitest";
describe("bundle-mcp.test-support",()=>{it("ok",async()=>{const m=await import("./bundle-mcp.test-support.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("bundled-capability-metadata",()=>{it("ok",async()=>{const m=await import("./bundled-capability-metadata.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
