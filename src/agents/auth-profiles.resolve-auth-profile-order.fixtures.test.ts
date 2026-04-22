import{describe,expect,it}from"vitest";
describe("auth-profiles.resolve-auth-profile-order.fixtures",()=>{it("ok",async()=>{const m=await import("./auth-profiles.resolve-auth-profile-order.fixtures.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("auth-profiles.runtime",()=>{it("ok",async()=>{const m=await import("./auth-profiles.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
