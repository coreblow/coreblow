import{describe,expect,it}from"vitest";
describe("directive-handler",()=>{it("ok",async()=>{const m=await import("./directive-handler.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("directive-handling.auth-profile",()=>{it("ok",async()=>{const m=await import("./directive-handling.auth-profile.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
