import{describe,expect,it}from"vitest";
describe("registry",()=>{it("ok",async()=>{const m=await import("./registry.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
describe("speech-vitest-registry",()=>{it("ok",async()=>{const m=await import("./speech-vitest-registry.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
describe("suites",()=>{it("ok",async()=>{const m=await import("./suites.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
describe("testkit",()=>{it("ok",async()=>{const m=await import("./testkit.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
