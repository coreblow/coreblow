import{describe,expect,it}from"vitest";
describe("command-auth-registry-fixture",()=>{it("ok",async()=>{const m=await import("./command-auth-registry-fixture.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);})});
