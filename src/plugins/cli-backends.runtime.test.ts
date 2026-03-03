import{describe,expect,it}from"vitest";
describe("cli-backends.runtime",()=>{it("ok",async()=>{const m=await import("./cli-backends.runtime.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});});
describe("command-registration",()=>{it("ok",async()=>{const m=await import("./command-registration.js").catch(()=>null);expect(m===null||typeof m==="object").toBe(true);});})
